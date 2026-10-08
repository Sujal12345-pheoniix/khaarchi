import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BalancesService } from '../balances/balances.service.js';
import { calculateSafeToSpend } from './calculators/safe-to-spend.calculator.js';
import { SafeToSpendResult, SafeToSpendInput } from './types/cashflow.types.js';
import {
  HomeType,
  BillStatus,
  RecurringInterval,
  ExpenseCategory,
  MemberRole,
} from '@homeexpense/shared';

@Injectable()
export class CashflowService {
  private readonly logger = new Logger(CashflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly balancesService: BalancesService
  ) {}

  /**
   * Calculates the authoritative Household Safe-to-Spend for the current period.
   * Reads exclusively from PostgreSQL financial models with strict double-counting protection.
   */
  async getSafeToSpend(
    homeId: string,
    referenceDate: Date = new Date()
  ): Promise<SafeToSpendResult> {
    const startTime = Date.now();

    // 1. Fetch Home configuration
    const home = await this.prisma.home.findUnique({
      where: { id: homeId },
      select: {
        id: true,
        name: true,
        type: true,
        currency: true,
        protectedReserve: true,
      },
    });

    if (!home) {
      throw new NotFoundException(`Household with ID ${homeId} was not found.`);
    }

    // 2. Compute calendar month boundaries (UTC)
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth(); // 0-indexed
    const periodStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

    // Previous month boundaries for period trend comparison
    const prevMonthDate = new Date(Date.UTC(year, month - 1, 1));
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth();
    const prevPeriodStart = new Date(Date.UTC(prevYear, prevMonth, 1, 0, 0, 0, 0));
    const prevPeriodEnd = new Date(Date.UTC(prevYear, prevMonth + 1, 0, 23, 59, 59, 999));

    // 3. Concurrently fetch all authoritative financial inputs
    const [
      postedExpenses,
      activeBudget,
      bills,
      recurringExpenses,
      balancesData,
      prevBudget,
      prevExpenses,
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
          date: true,
        },
      }),

      // Active monthly budget
      this.prisma.budget.findUnique({
        where: {
          homeId_year_month: {
            homeId,
            year,
            month: month + 1, // Prisma model stores 1-12
          },
        },
        include: { categories: true },
      }),

      // Household bills
      this.prisma.bill.findMany({
        where: { homeId },
        orderBy: { dueDate: 'asc' },
      }),

      // Active recurring commitments
      this.prisma.recurringExpense.findMany({
        where: { homeId, active: true },
      }),

      // Authoritative ledger & balance summary
      this.balancesService.getHomeBalances(homeId),

      // Previous month budget for comparison
      this.prisma.budget.findUnique({
        where: {
          homeId_year_month: {
            homeId,
            year: prevYear,
            month: prevMonth + 1,
          },
        },
      }),

      // Previous month expenses
      this.prisma.expense.findMany({
        where: {
          homeId,
          date: { gte: prevPeriodStart, lte: prevPeriodEnd },
        },
        select: {
          id: true,
          amount: true,
          category: true,
          date: true,
        },
      }),
    ]);

    // 4. Construct previous period result baseline if budget existed
    let previousPeriodResult: { safeToSpend: number } | null = null;
    if (prevBudget && Number(prevBudget.totalBudget) > 0) {
      const prevResult = calculateSafeToSpend({
        homeId,
        homeType: home.type as HomeType,
        currency: home.currency,
        referenceDate: prevPeriodEnd,
        periodStart: prevPeriodStart,
        periodEnd: prevPeriodEnd,
        budget: { totalBudget: Number(prevBudget.totalBudget) },
        protectedReserve: Number(home.protectedReserve || 0),
        postedExpenses: prevExpenses.map((e) => ({
          id: e.id,
          amount: Number(e.amount),
          category: e.category,
          date: e.date,
        })),
        bills: [],
        recurringExpenses: [],
      });
      previousPeriodResult = { safeToSpend: prevResult.safeToSpend };
    }

    // 5. Build input for pure domain calculator
    const calculatorInput: SafeToSpendInput = {
      homeId,
      homeType: home.type as HomeType,
      currency: home.currency,
      referenceDate,
      periodStart,
      periodEnd,
      budget: activeBudget
        ? {
            totalBudget: Number(activeBudget.totalBudget),
            categories: activeBudget.categories.map((c) => ({
              category: c.category,
              allocatedAmount: Number(c.allocatedAmount),
            })),
          }
        : null,
      protectedReserve: Number(home.protectedReserve || 0),
      postedExpenses: postedExpenses.map((e) => ({
        id: e.id,
        amount: Number(e.amount),
        category: e.category,
        date: e.date,
      })),
      bills: bills.map((b) => ({
        id: b.id,
        title: b.title,
        amount: Number(b.amount),
        dueDate: b.dueDate,
        status: b.status as BillStatus,
      })),
      recurringExpenses: recurringExpenses.map((r) => ({
        id: r.id,
        description: r.description,
        amount: Number(r.amount),
        nextRunAt: r.nextRunAt,
        interval: r.interval as RecurringInterval,
        category: r.category as ExpenseCategory,
        active: r.active,
      })),
      memberBalances: balancesData?.memberBalances?.map((mb) => ({
        memberId: mb.memberId,
        balance: mb.balance,
        status: mb.status,
      })),
      previousPeriodResult,
    };

    const result = calculateSafeToSpend(calculatorInput);

    const elapsedMs = Date.now() - startTime;
    this.logger.log(
      `Safe-to-Spend evaluated for Home ${homeId} in ${elapsedMs}ms: ₹${result.safeToSpend} (${result.status}, Confidence: ${result.confidence})`
    );

    return result;
  }

  /**
   * Configures or updates the household's protected emergency reserve.
   * STRICT AUTHORIZATION: ONLY the household OWNER can execute this action.
   */
  async updateProtectedReserve(
    homeId: string,
    actorUserId: string,
    reserveAmount: number
  ) {
    if (reserveAmount < 0) {
      throw new BadRequestException('Protected reserve cannot be negative.');
    }

    const callerMember = await this.prisma.homeMember.findUnique({
      where: { homeId_userId: { homeId, userId: actorUserId } },
    });

    if (!callerMember || !callerMember.isActive) {
      throw new ForbiddenException('Access denied: You are not an active member of this home.');
    }

    if (callerMember.role !== MemberRole.OWNER) {
      throw new ForbiddenException(
        'Permission denied: Only the household Owner can configure the protected reserve.'
      );
    }

    const updatedHome = await this.prisma.home.update({
      where: { id: homeId },
      data: { protectedReserve: reserveAmount },
    });

    this.logger.log(
      `Protected reserve updated for Home ${homeId}: ₹${reserveAmount} by Owner ${actorUserId}`
    );

    return {
      homeId,
      protectedReserve: Number(updatedHome.protectedReserve || 0),
    };
  }
}
