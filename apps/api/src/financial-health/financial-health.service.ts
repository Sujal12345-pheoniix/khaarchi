import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BalancesService } from '../balances/balances.service.js';
import { HealthSnapshotService } from './snapshots/health-snapshot.service.js';
import { getScoringProfile, SCORING_ALGORITHM_VERSION } from './scoring/scoring-profiles.js';
import { calculateBudgetDiscipline } from './calculators/budget-discipline.calculator.js';
import { calculateBillReadiness } from './calculators/bill-readiness.calculator.js';
import { calculateSpendingStability } from './calculators/spending-stability.calculator.js';
import { calculateDebtHealth } from './calculators/debt-health.calculator.js';
import { calculateRecurringLoad } from './calculators/recurring-load.calculator.js';
import { calculateContributionBalance } from './calculators/contribution-balance.calculator.js';
import { evaluateHealthScore } from './scoring/health-score.engine.js';
import { evaluateHealthRules } from './rules/health-rules.engine.js';
import { calculateScoreTrend } from './scoring/health-trend.engine.js';
import { FinancialHealthEvaluationResult, DimensionCalculationOutput } from './types/financial-health.types.js';
import { HomeType, ExpenseCategory, BillStatus, RecurringInterval } from '@homeexpense/shared';

@Injectable()
export class FinancialHealthService {
  private readonly logger = new Logger(FinancialHealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly balancesService: BalancesService,
    private readonly snapshotService: HealthSnapshotService
  ) {}

  async evaluateHomeHealth(homeId: string, referenceDate: Date = new Date()): Promise<FinancialHealthEvaluationResult> {
    const startTime = Date.now();

    // 1. Verify Home exists and fetch mode
    const home = await this.prisma.home.findUnique({
      where: { id: homeId },
      include: {
        members: {
          where: { isActive: true },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!home) {
      throw new NotFoundException(`Home with ID ${homeId} was not found.`);
    }

    const homeType = home.type as HomeType;
    const profileConfig = getScoringProfile(homeType);

    // 2. Compute date boundaries for current evaluation period (Calendar Month)
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth(); // 0-indexed
    const periodStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const currentDayOfMonth = Math.max(1, Math.min(referenceDate.getDate(), totalDaysInMonth));

    // 3. Load authoritative financial datasets concurrently (bounded by homeId and date ranges)
    const [
      currentExpenses,
      historicalExpenses,
      activeBudget,
      bills,
      recurringExpenses,
      balancesData,
      previousSnapshot,
    ] = await Promise.all([
      // Current period expenses
      this.prisma.expense.findMany({
        where: {
          homeId,
          date: { gte: periodStart, lte: periodEnd },
        },
        select: {
          id: true,
          amount: true,
          category: true,
          payerMemberId: true,
          date: true,
        },
      }),

      // Prior 3 months expenses for spending stability baseline
      this.fetchPriorMonthsSpending(homeId, year, month),

      // Active monthly budget & categories
      this.prisma.budget.findUnique({
        where: {
          homeId_year_month: {
            homeId,
            year,
            month: month + 1, // Prisma model uses 1-12
          },
        },
        include: { categories: true },
      }),

      // Household bills
      this.prisma.bill.findMany({
        where: { homeId },
        orderBy: { dueDate: 'asc' },
      }),

      // Active recurring expenses
      this.prisma.recurringExpense.findMany({
        where: { homeId, active: true },
      }),

      // Authoritative ledger & balance summary
      this.balancesService.getHomeBalances(homeId),

      // Prior analytical snapshot for trend comparison
      this.snapshotService.getLatestSnapshot(homeId),
    ]);

    // 4. Transform raw database records to calculator inputs
    const currentExpenseItems = currentExpenses.map((e) => ({
      amount: Number(e.amount),
      category: e.category as ExpenseCategory,
      payerMemberId: e.payerMemberId,
    }));

    const currentPeriodSpend = currentExpenseItems.reduce((sum, e) => sum + e.amount, 0);

    const budgetInput = activeBudget
      ? {
          totalBudget: Number(activeBudget.totalBudget),
          categories: activeBudget.categories.map((c) => ({
            category: c.category as ExpenseCategory,
            allocatedAmount: Number(c.allocatedAmount),
          })),
        }
      : null;

    const billItems = bills.map((b) => ({
      id: b.id,
      title: b.title,
      amount: Number(b.amount),
      dueDate: b.dueDate,
      status: b.status as BillStatus,
    }));

    const recurringItems = recurringExpenses.map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      interval: r.interval as RecurringInterval,
      active: r.active,
    }));

    // Member contributions for Family mode
    const memberPaidMap = new Map<string, number>();
    for (const exp of currentExpenseItems) {
      memberPaidMap.set(exp.payerMemberId, (memberPaidMap.get(exp.payerMemberId) || 0) + exp.amount);
    }

    const memberContributions = home.members.map((m) => ({
      memberId: m.id,
      name: m.user.name || 'Member',
      amountPaid: memberPaidMap.get(m.id) || 0,
    }));

    // Comparable spend for recurring load calculation (either baseline or active budget or normalized spend)
    const baselineMonthlySpend =
      historicalExpenses.length > 0
        ? historicalExpenses.reduce((a, b) => a + b, 0) / historicalExpenses.length
        : budgetInput?.totalBudget || currentPeriodSpend;

    // 5. Execute Pure Deterministic Calculators
    const budgetDiscipline = calculateBudgetDiscipline({
      budget: budgetInput,
      currentExpenses: currentExpenseItems,
      daysInPeriod: totalDaysInMonth,
      daysElapsed: currentDayOfMonth,
    });

    const billReadiness = calculateBillReadiness({
      bills: billItems,
      referenceDate,
    });

    const spendingStability = calculateSpendingStability({
      currentPeriodSpend,
      daysInPeriod: totalDaysInMonth,
      daysElapsed: currentDayOfMonth,
      historicalMonthlySpends: historicalExpenses,
    });

    const debtHealth = calculateDebtHealth({
      memberBalances: balancesData.memberBalances,
      totalSpending: balancesData.totalSpending,
      totalExpenseCount: balancesData.totalExpenseCount,
    });

    const recurringLoad = calculateRecurringLoad({
      recurringExpenses: recurringItems,
      comparableMonthlySpend: baselineMonthlySpend,
    });

    const contributionBalance = calculateContributionBalance({
      homeType,
      memberContributions,
      totalSpend: currentPeriodSpend,
    });

    const dimensionOutputs: DimensionCalculationOutput[] = [
      budgetDiscipline,
      billReadiness,
      spendingStability,
      debtHealth,
      recurringLoad,
      contributionBalance,
    ];

    // 6. Aggregate Health Score using selected Profile (Family vs Bachelor)
    const scoreResult = evaluateHealthScore(dimensionOutputs, profileConfig);

    // 7. Execute Health Rules Engine to generate specific, measurable insights
    const rulesResult = evaluateHealthRules({
      dimensionOutputs,
      budget: budgetInput,
      currentExpenses: currentExpenseItems,
      bills: billItems,
      daysInPeriod: totalDaysInMonth,
      daysElapsed: currentDayOfMonth,
    });

    // 8. Calculate Historical Trend and Component Movement
    const previousSnapshotData = previousSnapshot
      ? {
          score: previousSnapshot.score,
          dimensionScores: previousSnapshot.dimensionScores as any,
        }
      : null;

    const trend = calculateScoreTrend(scoreResult.score, scoreResult.breakdown, previousSnapshotData);

    const evaluationResult: FinancialHealthEvaluationResult = {
      score: scoreResult.score,
      status: scoreResult.status,
      scoringVersion: SCORING_ALGORITHM_VERSION,
      profile: homeType,
      confidence: scoreResult.confidence,
      dataSufficiency: scoreResult.dataSufficiency,
      period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
      },
      trend,
      breakdown: scoreResult.breakdown,
      strengths: rulesResult.strengths,
      risks: rulesResult.risks,
      insights: rulesResult.insights,
    };

    // 9. Persist Asynchronous Analytical Snapshot (non-blocking)
    void this.snapshotService.recordSnapshot(homeId, evaluationResult);

    const elapsed = Date.now() - startTime;
    this.logger.log(`Financial health evaluated for Home ${homeId} in ${elapsed}ms: Score ${scoreResult.score ?? 'N/A'} (${scoreResult.status})`);

    return evaluationResult;
  }

  /**
   * Helper: fetches previous 3 completed calendar months' total expenditures
   */
  private async fetchPriorMonthsSpending(
    homeId: string,
    currentYear: number,
    currentMonth: number // 0-indexed
  ): Promise<number[]> {
    const historicalSpends: number[] = [];

    for (let i = 1; i <= 3; i++) {
      const targetMonthDate = new Date(Date.UTC(currentYear, currentMonth - i, 1));
      const targetYear = targetMonthDate.getUTCFullYear();
      const targetMonth = targetMonthDate.getUTCMonth();

      const mStart = new Date(Date.UTC(targetYear, targetMonth, 1, 0, 0, 0, 0));
      const mEnd = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59, 999));

      const agg = await this.prisma.expense.aggregate({
        where: {
          homeId,
          date: { gte: mStart, lte: mEnd },
        },
        _sum: { amount: true },
        _count: true,
      });

      if (agg._count > 0 && agg._sum.amount != null) {
        historicalSpends.push(Number(agg._sum.amount));
      }
    }

    return historicalSpends;
  }
}
