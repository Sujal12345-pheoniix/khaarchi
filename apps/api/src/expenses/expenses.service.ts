import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateExpenseInput,
  AuditAction,
  MemberRole,
  toCents,
  toMajor,
  validateExpenseSplits,
} from '@homeexpense/shared';
import { Prisma } from '@homeexpense/database';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async createExpense(homeId: string, actorUserId: string, input: CreateExpenseInput) {
    // 1. Verify and auto-reconcile splits
    let splits = input.splits || [];
    const totalCents = toCents(input.amount);

    return this.prisma.$transaction(async (tx) => {
      // 2. Validate or auto-resolve payer
      let payerId = input.payerMemberId;
      if (!payerId) {
        const defaultMember = await tx.homeMember.findFirst({
          where: { homeId, userId: actorUserId, isActive: true },
        }) || await tx.homeMember.findFirst({
          where: { homeId, isActive: true },
        });
        payerId = defaultMember?.id || '';
      }

      const payer = await tx.homeMember.findFirst({
        where: { id: payerId, homeId, isActive: true },
      });
      if (!payer) {
        throw new BadRequestException('Payer member is not an active member of this home.');
      }

      // 3. Validate or auto-resolve participants
      const allActiveMembers = await tx.homeMember.findMany({
        where: { homeId, isActive: true },
      });

      if (!splits || splits.length === 0) {
        // Auto-split equally among all active members
        const activeIds = allActiveMembers.map((m) => m.id);
        const count = activeIds.length;
        const baseCents = Math.floor(totalCents / count);
        let rem = totalCents % count;
        splits = activeIds.map((id) => {
          let cents = baseCents;
          if (rem > 0) {
            cents += 1;
            rem -= 1;
          }
          return {
            memberId: id,
            amount: toMajor(cents),
          };
        });
      } else {
        // Reconcile any small cent discrepancies automatically
        const sumSplitsCents = splits.reduce((acc, s) => acc + toCents(s.amount), 0);
        const discrepancy = totalCents - sumSplitsCents;
        if (discrepancy !== 0 && splits.length > 0) {
          const targetSplit = splits[0];
          const adjustedCents = toCents(targetSplit.amount) + discrepancy;
          if (adjustedCents > 0) {
            targetSplit.amount = toMajor(adjustedCents);
          }
        }
      }

      const splitValidation = validateExpenseSplits({
        totalAmount: input.amount,
        splits,
      });
      if (!splitValidation.valid) {
        throw new BadRequestException(splitValidation.error);
      }

      // 3. Validate all split participants belong to home and are active
      const participantIds = splits.map((s) => s.memberId);
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
          payerMemberId: payerId,
          amount: new Prisma.Decimal(input.amount),
          description: input.description || `${input.category || 'Household'} Expense`,
          category: input.category,
          splitType: input.splitType,
          receiptUrl: input.receiptUrl,
          notes: input.notes,
          date: input.date ? new Date(input.date) : new Date(),
        },
      });

      // 5. Create ExpenseSplit records
      await tx.expenseSplit.createMany({
        data: splits.map((s) => ({
          expenseId: expense.id,
          memberId: s.memberId,
          amount: new Prisma.Decimal(s.amount),
          percentage: (s as any).percentage ? new Prisma.Decimal((s as any).percentage) : null,
          shares: (s as any).shares || null,
        })),
      });

      // 6. Create LedgerEntry records
      // For each participant who is NOT the payer, debtor owes creditor (payer)
      const ledgerEntriesData: Prisma.LedgerEntryCreateManyInput[] = [];

      for (const split of splits) {
        if (split.memberId !== payerId) {
          ledgerEntriesData.push({
            homeId,
            expenseId: expense.id,
            debtorMemberId: split.memberId,
            creditorMemberId: payerId,
            amount: new Prisma.Decimal(split.amount),
            notes: `Split for expense: ${input.description || 'Household Expense'}`,
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
      // 1. Authenticated user & home membership check
      const callerMember = await tx.homeMember.findUnique({
        where: { homeId_userId: { homeId, userId: actorUserId } },
      });

      if (!callerMember || !callerMember.isActive) {
        throw new ForbiddenException('Access denied: You are not an active member of this home.');
      }

      // 2. Resource context & ownership check
      const expense = await tx.expense.findFirst({
        where: { id: expenseId, homeId },
        include: { payer: true },
      });

      if (!expense) {
        throw new NotFoundException('Expense not found in this home.');
      }

      const isPayer = expense.payer.userId === actorUserId;
      const hasElevatedRole = callerMember.role === MemberRole.OWNER || callerMember.role === MemberRole.ADMIN;

      // Object-Level Security: Only the payer or an Owner/Admin can delete this expense
      if (!isPayer && !hasElevatedRole) {
        throw new ForbiddenException(
          'Object-level security violation: You can only delete expenses that you paid for unless you are a Home Owner or Admin.'
        );
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
            payerUserId: expense.payer.userId,
          },
        },
      });

      return { success: true, message: 'Expense and associated ledger entries deleted.' };
    });
  }
}
