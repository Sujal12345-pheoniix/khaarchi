import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateSettlementInput,
  AuditAction,
  toCents,
  toMajor,
  validateSettlementAmount,
} from '@homeexpense/shared';
import { Prisma } from '@homeexpense/database';

@Injectable()
export class SettlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async createSettlement(homeId: string, actorUserId: string, input: CreateSettlementInput) {
    if (input.fromMemberId === input.toMemberId) {
      throw new BadRequestException('Payer and payee member cannot be the same person.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Verify both members belong to this home and are active
      const [fromMember, toMember] = await Promise.all([
        tx.homeMember.findFirst({
          where: { id: input.fromMemberId, homeId, isActive: true },
          include: { user: true },
        }),
        tx.homeMember.findFirst({
          where: { id: input.toMemberId, homeId, isActive: true },
          include: { user: true },
        }),
      ]);

      if (!fromMember || !toMember) {
        throw new BadRequestException('One or both settlement participants are not active members of this home.');
      }

      // 2. Calculate current debt between fromMember and toMember
      const entries = await tx.ledgerEntry.findMany({
        where: {
          homeId,
          OR: [
            { debtorMemberId: input.fromMemberId, creditorMemberId: input.toMemberId },
            { debtorMemberId: input.toMemberId, creditorMemberId: input.fromMemberId },
          ],
        },
      });

      let netDebtCents = 0;
      for (const e of entries) {
        const cents = toCents(Number(e.amount));
        if (e.debtorMemberId === input.fromMemberId && e.creditorMemberId === input.toMemberId) {
          netDebtCents += cents; // fromMember owes toMember
        } else if (e.debtorMemberId === input.toMemberId && e.creditorMemberId === input.fromMemberId) {
          netDebtCents -= cents; // toMember owes fromMember
        }
      }

      const netDebt = toMajor(netDebtCents);
      const invariant = validateSettlementAmount(input.amount, netDebt > 0 ? netDebt : 0);
      if (!invariant.valid) {
        throw new BadRequestException(invariant.error);
      }

      // 3. Create Settlement
      const settlement = await tx.settlement.create({
        data: {
          homeId,
          fromMemberId: input.fromMemberId,
          toMemberId: input.toMemberId,
          amount: new Prisma.Decimal(input.amount),
          notes: input.notes,
          proofUrl: input.proofUrl,
        },
      });

      // 4. Create Counterbalancing LedgerEntry
      await tx.ledgerEntry.create({
        data: {
          homeId,
          settlementId: settlement.id,
          debtorMemberId: input.toMemberId,
          creditorMemberId: input.fromMemberId,
          amount: new Prisma.Decimal(input.amount),
          notes: `Settlement payment from ${fromMember.user.name} to ${toMember.user.name}`,
        },
      });

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          homeId,
          actorUserId,
          action: AuditAction.SETTLE,
          entityType: 'SETTLEMENT',
          entityId: settlement.id,
          payload: {
            fromMemberId: input.fromMemberId,
            toMemberId: input.toMemberId,
            amount: input.amount,
          },
        },
      });

      return tx.settlement.findUnique({
        where: { id: settlement.id },
        include: {
          fromMember: { include: { user: { select: { id: true, name: true, email: true } } } },
          toMember: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      });
    });
  }

  async getHomeSettlements(homeId: string) {
    const settlements = await this.prisma.settlement.findMany({
      where: { homeId },
      orderBy: { settledAt: 'desc' },
      include: {
        fromMember: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
        toMember: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
      },
    });

    return settlements.map((s) => ({
      ...s,
      amount: Number(s.amount),
    }));
  }
}
