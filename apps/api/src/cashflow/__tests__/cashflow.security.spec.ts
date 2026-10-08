import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HomeMemberGuard } from '../../homes/guards/home-member.guard.js';
import { CashflowService } from '../cashflow.service.js';
import { MemberRole, HomeType, BillStatus } from '@homeexpense/shared';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('Cashflow Security & Cross-Home Isolation', () => {
  let mockPrisma: any;
  let mockReflector: any;
  let guard: HomeMemberGuard;
  let service: CashflowService;

  const homeA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const homeB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const userA = 'user-alpha-id';
  const userB = 'user-beta-id';

  beforeEach(() => {
    mockPrisma = {
      homeMember: {
        findUnique: vi.fn(),
      },
      home: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      expense: {
        findMany: vi.fn(),
      },
      budget: {
        findUnique: vi.fn(),
      },
      bill: {
        findMany: vi.fn(),
      },
      recurringExpense: {
        findMany: vi.fn(),
      },
    };

    mockReflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    };

    guard = new HomeMemberGuard(mockReflector as any, mockPrisma as any);
    service = new CashflowService(
      mockPrisma as any,
      { getHomeBalances: vi.fn().mockResolvedValue({ memberBalances: [] }) } as any
    );
  });

  describe('HomeMemberGuard Tenant Isolation', () => {
    it('ALLOWS active member of Home A to access Home A cashflow', async () => {
      mockPrisma.homeMember.findUnique.mockResolvedValue({
        id: 'member-a-1',
        homeId: homeA,
        userId: userA,
        role: MemberRole.MEMBER,
        isActive: true,
        home: { id: homeA, isArchived: false },
      });

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            params: { homeId: homeA },
            user: { id: userA },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any;

      const allowed = await guard.canActivate(mockContext);
      expect(allowed).toBe(true);
    });

    it('DENIES member of Home B when attempting to access Home A cashflow (Cross-Home Attack)', async () => {
      // User B only belongs to Home B, has no membership in Home A
      mockPrisma.homeMember.findUnique.mockResolvedValue(null);

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            params: { homeId: homeA }, // requesting Home A
            user: { id: userB },      // but is User B
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('DENIES deactivated member from accessing household cashflow', async () => {
      mockPrisma.homeMember.findUnique.mockResolvedValue({
        id: 'member-a-deactivated',
        homeId: homeA,
        userId: userA,
        role: MemberRole.MEMBER,
        isActive: false, // deactivated!
        home: { id: homeA, isArchived: false },
      });

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            params: { homeId: homeA },
            user: { id: userA },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('Data Isolation: Strict Home Scoping in Queries', () => {
    it('verifies that all queries are strictly filtered by requested homeId', async () => {
      mockPrisma.home.findUnique.mockResolvedValue({
        id: homeA,
        type: HomeType.FAMILY,
        currency: 'INR',
        protectedReserve: 0,
      });

      mockPrisma.expense.findMany.mockResolvedValue([]);
      mockPrisma.budget.findUnique.mockResolvedValue(null);
      mockPrisma.bill.findMany.mockResolvedValue([]);
      mockPrisma.recurringExpense.findMany.mockResolvedValue([]);

      await service.getSafeToSpend(homeA);

      // Verify Home A filter is explicitly attached to every database query
      expect(mockPrisma.home.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: homeA } })
      );
      expect(mockPrisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ homeId: homeA }) })
      );
      expect(mockPrisma.bill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { homeId: homeA } })
      );
      expect(mockPrisma.recurringExpense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { homeId: homeA, active: true } })
      );
    });
  });
});
