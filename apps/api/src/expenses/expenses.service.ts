import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateExpenseInput,
  AuditAction,
  toCents,
  toMajor,
  validateExpenseSplits,
} from '@homeexpense/shared';
import { Prisma } from '@homeexpense/database';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async createExpense(homeId: string, actorUserId: string, input: CreateExpenseInput) {
    // 1. Verify splits invariant
    const splitValidation = validateExpenseSplits({
      totalAmount: input.amount,
      splits: input.splits,
    });
    if (!splitValidation.valid) {
      throw new BadRequestException(splitValidation.error);
    }

    return this.prisma.$transaction(async (tx) => {
      // 2. Validate payer belongs to home and is active
      const payer = await tx.homeMember.findFirst({
        where: { id: input.payerMemberId, homeId, isActive: true },
      });
      if (!payer) {
        throw new BadRequestException('Payer member is not an active member of this home.');
      }

      // 3. Validate all split participants belong to home and are active
      const participantIds = input.splits.map((s) => s.memberId);
      const activeMembers = await tx.homeMember.findMany({
        where: {
          id: { in: participantIds },
          homeId,
          isActive: true,
        },
        select: { id: true },
      });

      if (activeMembers.length !== participantIds.length) {
        throw new BadRequestException('One or more split participants are not active members of this home.');
      }

      // 4. Create the Expense record
      const expense = await tx.expense.create({
        data: {
          homeId,
          payerMemberId: input.payerMemberId,
          amount: new Prisma.Decimal(input.amount),
          description: input.description,
          category: input.category,
          splitType: input.splitType,
          receiptUrl: input.receiptUrl,
          notes: input.notes,
          date: new Date(input.date),
        },
      });

      // 5. Create ExpenseSplit records
      await tx.expenseSplit.createMany({
        data: input.splits.map((s) => ({
          expenseId: expense.id,
          memberId: s.memberId,
          amount: new Prisma.Decimal(s.amount),
          percentage: s.percentage ? new Prisma.Decimal(s.percentage) : null,
          shares: s.shares || null,
        })),
      });

      // 6. Create LedgerEntry records
      // For each participant who is NOT the payer, debtor owes creditor (payer)
      const ledgerEntriesData: Prisma.LedgerEntryCreateManyInput[] = [];

      for (const split of input.splits) {
        if (split.memberId !== input.payerMemberId) {
          ledgerEntriesData.push({
            homeId,
            expenseId: expense.id,
            debtorMemberId: split.memberId,
            creditorMemberId: input.payerMemberId,
            amount: new Prisma.Decimal(split.amount),
            notes: `Split for expense: ${input.description}`,
          });
        }
      }

      if (ledgerEntriesData.length > 0) {
        await tx.ledgerEntry.createMany({
          data: ledgerEntriesData,
        });
      }

      // 7. Audit Log
      await tx.auditLog.create({
        data: {
          homeId,
          actorUserId,
          action: AuditAction.CREATE,
          entityType: 'EXPENSE',
          entityId: expense.id,
          payload: {
            amount: input.amount,
            description: input.description,
            payerMemberId: input.payerMemberId,
            splitsCount: input.splits.length,
          },
        },
      });

      // Return full created entity
      return tx.expense.findUnique({
        where: { id: expense.id },
        include: {
          payer: {
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
          },
          splits: {
            include: {
              member: {
                include: {
                  user: { select: { id: true, name: true, email: true, avatarUrl: true } },
                },
              },
            },
          },
          ledgerEntries: true,
        },
      });
    });
  }

  async getHomeExpenses(homeId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [total, expenses] = await Promise.all([
      this.prisma.expense.count({ where: { homeId } }),
      this.prisma.expense.findMany({
        where: { homeId },
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          payer: {
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
          },
          splits: {
            include: {
              member: {
                include: {
                  user: { select: { id: true, name: true, email: true, avatarUrl: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: expenses.map((e) => ({
        ...e,
        amount: Number(e.amount),
        splits: e.splits.map((s) => ({
          ...s,
          amount: Number(s.amount),
          percentage: s.percentage ? Number(s.percentage) : null,
        })),
      })),
    };
  }

  async getExpenseById(homeId: string, expenseId: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, homeId },
      include: {
        payer: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
        splits: {
          include: {
            member: {
              include: {
                user: { select: { id: true, name: true, email: true, avatarUrl: true } },
              },
            },
          },
        },
        ledgerEntries: true,
      },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found.');
    }

    return {
      ...expense,
      amount: Number(expense.amount),
      splits: expense.splits.map((s) => ({
        ...s,
        amount: Number(s.amount),
        percentage: s.percentage ? Number(s.percentage) : null,
      })),
    };
  }

  async deleteExpense(homeId: string, actorUserId: string, expenseId: string) {
    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findFirst({
        where: { id: expenseId, homeId },
      });

      if (!expense) {
        throw new NotFoundException('Expense not found.');
      }

      await tx.expense.delete({
        where: { id: expenseId },
      });

      await tx.auditLog.create({
        data: {
          homeId,
          actorUserId,
          action: AuditAction.DELETE,
          entityType: 'EXPENSE',
          entityId: expenseId,
          payload: {
            amount: Number(expense.amount),
            description: expense.description,
          },
        },
      });

      return { success: true, message: 'Expense and associated ledger entries deleted.' };
    });
  }
}
