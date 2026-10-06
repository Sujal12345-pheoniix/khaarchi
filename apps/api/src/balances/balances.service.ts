import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  toCents,
  toMajor,
  simplifyDebts,
  validateZeroSumLedger,
} from '@homeexpense/shared';

@Injectable()
export class BalancesService {
  private readonly logger = new Logger(BalancesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getHomeBalances(homeId: string) {
    // 1. Fetch active members
    const members = await this.prisma.homeMember.findMany({
      where: { homeId, isActive: true },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    const memberMap = new Map<string, (typeof members)[0]>();
    for (const m of members) {
      memberMap.set(m.id, m);
    }

    // 2. Fetch all ledger entries for this home
    const ledgerEntries = await this.prisma.ledgerEntry.findMany({
      where: { homeId },
    });

    // 3. Compute net balances in integer minor units (cents)
    const netCentsMap = new Map<string, number>();
    for (const m of members) {
      netCentsMap.set(m.id, 0);
    }

    // Pairwise debts: debtsMap[from][to] = cents
    const pairwiseDebts = new Map<string, Map<string, number>>();
    for (const m1 of members) {
      pairwiseDebts.set(m1.id, new Map());
      for (const m2 of members) {
        if (m1.id !== m2.id) {
          pairwiseDebts.get(m1.id)!.set(m2.id, 0);
        }
      }
    }

    for (const entry of ledgerEntries) {
      const entryCents = toCents(Number(entry.amount));

      // Update debtor (owes money: negative impact on balance)
      if (netCentsMap.has(entry.debtorMemberId)) {
        netCentsMap.set(
          entry.debtorMemberId,
          netCentsMap.get(entry.debtorMemberId)! - entryCents
        );
      }

      // Update creditor (is owed money: positive impact on balance)
      if (netCentsMap.has(entry.creditorMemberId)) {
        netCentsMap.set(
          entry.creditorMemberId,
          netCentsMap.get(entry.creditorMemberId)! + entryCents
        );
      }

      // Pairwise tracking
      const fromMap = pairwiseDebts.get(entry.debtorMemberId);
      if (fromMap && fromMap.has(entry.creditorMemberId)) {
        fromMap.set(
          entry.creditorMemberId,
          fromMap.get(entry.creditorMemberId)! + entryCents
        );
      }
    }

    // Net pairwise debts (cancel mutual debts: if A owes B 50 and B owes A 20 -> A owes B 30)
    const pairwiseSummary: {
      fromMemberId: string;
      toMemberId: string;
      fromName: string;
      toName: string;
      amount: number;
    }[] = [];

    const memberIds = members.map((m) => m.id);
    for (let i = 0; i < memberIds.length; i++) {
      for (let j = i + 1; j < memberIds.length; j++) {
        const idA = memberIds[i];
        const idB = memberIds[j];

        const aOwesB = pairwiseDebts.get(idA)?.get(idB) || 0;
        const bOwesA = pairwiseDebts.get(idB)?.get(idA) || 0;

        const netDifference = aOwesB - bOwesA;
        if (netDifference > 0) {
          pairwiseSummary.push({
            fromMemberId: idA,
            toMemberId: idB,
            fromName: memberMap.get(idA)?.user.name || 'Member',
            toName: memberMap.get(idB)?.user.name || 'Member',
            amount: toMajor(netDifference),
          });
        } else if (netDifference < 0) {
          pairwiseSummary.push({
            fromMemberId: idB,
            toMemberId: idA,
            fromName: memberMap.get(idB)?.user.name || 'Member',
            toName: memberMap.get(idA)?.user.name || 'Member',
            amount: toMajor(-netDifference),
          });
        }
      }
    }

    // Format net balances
    const memberBalances = members.map((m) => {
      const cents = netCentsMap.get(m.id) || 0;
      return {
        memberId: m.id,
        user: m.user,
        role: m.role,
        balance: toMajor(cents),
        status: cents > 0 ? ('OWED' as const) : cents < 0 ? ('OWES' as const) : ('SETTLED' as const),
      };
    });

    // Verify Financial Invariant 5: Zero-sum ledger
    const invariantCheck = validateZeroSumLedger(
      memberBalances.map((mb) => ({ memberId: mb.memberId, balance: mb.balance }))
    );
    if (!invariantCheck.valid) {
      this.logger.error(`CRITICAL: Zero-sum invariant failed for Home ${homeId}: ${invariantCheck.error}`);
    }

    // Calculate simplified debt minimization settlements
    const simplified = simplifyDebts(
      memberBalances.map((mb) => ({ memberId: mb.memberId, balance: mb.balance }))
    ).map((s) => ({
      ...s,
      fromName: memberMap.get(s.fromMemberId)?.user.name || 'Member',
      toName: memberMap.get(s.toMemberId)?.user.name || 'Member',
    }));

    // Aggregate totals: Total Home Spending
    const totalExpenses = await this.prisma.expense.aggregate({
      where: { homeId },
      _sum: { amount: true },
      _count: true,
    });

    return {
      homeId,
      totalSpending: Number(totalExpenses._sum.amount || 0),
      totalExpenseCount: totalExpenses._count,
      memberBalances,
      pairwiseDebts: pairwiseSummary,
      suggestedSettlements: simplified,
      isReconciled: invariantCheck.valid,
    };
  }
}
