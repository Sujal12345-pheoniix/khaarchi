import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  MemberRole,
  AuditAction,
  ExpenseCategory,
  toCents,
  toMajor,
} from '@homeexpense/shared';
import { Prisma } from '@homeexpense/database';
import { SetBudgetDto } from './dto/set-budget.dto.js';

@Injectable()
export class BudgetsService {
  private readonly logger = new Logger(BudgetsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get active budget for the home for the specified month/year (defaults to current month)
   * with real spent figures aggregated from PostgreSQL expenses.
   */
  async getCurrentBudget(homeId: string, targetMonth?: number, targetYear?: number) {
    const now = new Date();
    const month = targetMonth || now.getMonth() + 1; // 1-12
    const year = targetYear || now.getFullYear();

    // Date range for the requested calendar month (UTC)
    const periodStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    // 1. Fetch budget & category envelopes
    const budget = await this.prisma.budget.findUnique({
      where: {
        homeId_year_month: {
          homeId,
          year,
          month,
        },
      },
      include: {
        categories: true,
      },
    });

    // 2. Aggregate actual expenses for this home in this month
    const expenses = await this.prisma.expense.findMany({
      where: {
        homeId,
        date: { gte: periodStart, lte: periodEnd },
      },
      select: {
        amount: true,
        category: true,
      },
    });

    // Compute spent cents per category
    const categorySpentCentsMap = new Map<string, number>();
    let totalSpentCents = 0;

    for (const exp of expenses) {
      const cents = toCents(Number(exp.amount));
      totalSpentCents += cents;
      const prev = categorySpentCentsMap.get(exp.category) || 0;
      categorySpentCentsMap.set(exp.category, prev + cents);
    }

    const totalSpent = toMajor(totalSpentCents);

    if (!budget) {
      // Return unconfigured envelope overview showing real expense totals by category
      const categoriesSummary = Object.values(ExpenseCategory).map((cat) => {
        const spentCents = categorySpentCentsMap.get(cat) || 0;
        return {
          category: cat,
          allocatedAmount: 0,
          spentAmount: toMajor(spentCents),
          remainingAmount: 0,
          utilizationPercentage: 0,
          isOverrun: false,
        };
      }).filter((c) => c.spentAmount > 0);

      return {
        hasBudget: false,
        month,
        year,
        totalBudget: 0,
        totalSpent,
        remainingBudget: 0,
        utilizationPercentage: 0,
        categories: categoriesSummary,
      };
    }

    const totalBudgetCents = toCents(Number(budget.totalBudget));
    const totalBudget = toMajor(totalBudgetCents);
    const remainingBudgetCents = Math.max(0, totalBudgetCents - totalSpentCents);
    const remainingBudget = toMajor(remainingBudgetCents);
    const utilizationPercentage =
      totalBudgetCents > 0
        ? Number(((totalSpentCents / totalBudgetCents) * 100).toFixed(1))
        : 0;

    // Build category envelopes
    const envelopes = budget.categories.map((cat) => {
      const allocatedCents = toCents(Number(cat.allocatedAmount));
      const spentCents = categorySpentCentsMap.get(cat.category) || 0;
      const allocatedAmount = toMajor(allocatedCents);
      const spentAmount = toMajor(spentCents);
      const remainingCents = Math.max(0, allocatedCents - spentCents);
      const remainingAmount = toMajor(remainingCents);
      const utilPct =
        allocatedCents > 0
          ? Number(((spentCents / allocatedCents) * 100).toFixed(1))
          : 0;

      return {
        id: cat.id,
        category: cat.category,
        allocatedAmount,
        spentAmount,
        remainingAmount,
        utilizationPercentage: utilPct,
        isOverrun: spentCents > allocatedCents,
      };
    });

    return {
      hasBudget: true,
      id: budget.id,
      month,
      year,
      totalBudget,
      totalSpent,
      remainingBudget,
      utilizationPercentage,
      categories: envelopes,
      createdAt: budget.createdAt.toISOString(),
      updatedAt: budget.updatedAt.toISOString(),
    };
  }

  /**
   * Set or update monthly budget and category envelopes.
   * STRICT AUTHORIZATION: ONLY the Home OWNER can execute this action.
   */
  async setBudget(homeId: string, actorUserId: string, input: SetBudgetDto) {
    // 1. Strict Owner Authorization Check
    const callerMember = await this.prisma.homeMember.findUnique({
      where: { homeId_userId: { homeId, userId: actorUserId } },
    });

    if (!callerMember || !callerMember.isActive) {
      throw new ForbiddenException('Access denied: You are not an active member of this home.');
    }

    if (callerMember.role !== MemberRole.OWNER) {
      throw new ForbiddenException(
        'Permission denied: Only the household Owner can create or modify the family budget.'
      );
    }

    if (!input.totalBudget || input.totalBudget <= 0) {
      throw new BadRequestException('Total monthly budget must be greater than zero.');
    }

    const now = new Date();
    const month = input.month || now.getMonth() + 1;
    const year = input.year || now.getFullYear();

    if (month < 1 || month > 12) {
      throw new BadRequestException('Month must be between 1 and 12.');
    }
    if (year < 2020 || year > 2100) {
      throw new BadRequestException('Year must be valid.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 2. Upsert Budget record
      const budget = await tx.budget.upsert({
        where: {
          homeId_year_month: {
            homeId,
            year,
            month,
          },
        },
        create: {
          homeId,
          year,
          month,
          totalBudget: new Prisma.Decimal(input.totalBudget),
        },
        update: {
          totalBudget: new Prisma.Decimal(input.totalBudget),
        },
      });

      // 3. Atomically replace category allocations
      await tx.budgetCategory.deleteMany({
        where: { budgetId: budget.id },
      });

      if (input.categories && input.categories.length > 0) {
        // Filter out zero or negative envelopes
        const validCategories = input.categories.filter((c) => c.allocatedAmount > 0);

        if (validCategories.length > 0) {
          await tx.budgetCategory.createMany({
            data: validCategories.map((c) => ({
              budgetId: budget.id,
              category: c.category,
              allocatedAmount: new Prisma.Decimal(c.allocatedAmount),
            })),
          });
        }
      }

      // 4. Record Audit Log entry
      await tx.auditLog.create({
        data: {
          homeId,
          actorUserId,
          action: AuditAction.CREATE,
          entityType: 'BUDGET',
          entityId: budget.id,
          payload: {
            totalBudget: input.totalBudget,
            month,
            year,
            categoryCount: input.categories?.length || 0,
          },
        },
      });

      this.logger.log(`Budget configured for Home ${homeId} (${month}/${year}): ₹${input.totalBudget} by Owner ${actorUserId}`);

      return budget;
    }).then(() => this.getCurrentBudget(homeId, month, year));
  }
}
