import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BudgetsService } from '../budgets.service.js';
import { MemberRole, ExpenseCategory } from '@homeexpense/shared';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

describe('BudgetsService', () => {
  let mockPrisma: any;
  let service: BudgetsService;

  const homeId = 'home-1111-2222-3333-4444';
  const ownerUserId = 'user-owner-1111';
  const memberUserId = 'user-member-2222';

  beforeEach(() => {
    mockPrisma = {
      budget: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      budgetCategory: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      expense: {
        findMany: vi.fn(),
      },
      homeMember: {
        findUnique: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(mockPrisma)),
    };

    service = new BudgetsService(mockPrisma);
  });

  describe('getCurrentBudget', () => {
    it('returns unconfigured response with actual expense totals when no budget is set', async () => {
      mockPrisma.budget.findUnique.mockResolvedValue(null);
      mockPrisma.expense.findMany.mockResolvedValue([
        { amount: 1500, category: ExpenseCategory.GROCERIES },
        { amount: 500, category: ExpenseCategory.UTILITIES },
      ]);

      const result = await service.getCurrentBudget(homeId, 10, 2026);

      expect(result.hasBudget).toBe(false);
      expect(result.totalBudget).toBe(0);
      expect(result.totalSpent).toBe(2000);
      expect(result.categories.length).toBe(2);
      expect(result.categories.find((c) => c.category === ExpenseCategory.GROCERIES)?.spentAmount).toBe(1500);
    });

    it('returns structured envelopes with real spent, remaining, and overrun flags when budget exists', async () => {
      mockPrisma.budget.findUnique.mockResolvedValue({
        id: 'b1',
        homeId,
        year: 2026,
        month: 10,
        totalBudget: '50000',
        createdAt: new Date('2026-10-01'),
        updatedAt: new Date('2026-10-01'),
        categories: [
          { id: 'bc1', category: ExpenseCategory.GROCERIES, allocatedAmount: '20000' },
          { id: 'bc2', category: ExpenseCategory.UTILITIES, allocatedAmount: '10000' },
        ],
      });

      mockPrisma.expense.findMany.mockResolvedValue([
        { amount: 22000, category: ExpenseCategory.GROCERIES },
        { amount: 4000, category: ExpenseCategory.UTILITIES },
      ]);

      const result = await service.getCurrentBudget(homeId, 10, 2026);

      expect(result.hasBudget).toBe(true);
      expect(result.totalBudget).toBe(50000);
      expect(result.totalSpent).toBe(26000);
      expect(result.remainingBudget).toBe(24000);
      expect(result.utilizationPercentage).toBe(52);

      const groceryEnvelope = result.categories.find((c) => c.category === ExpenseCategory.GROCERIES);
      expect(groceryEnvelope).toBeDefined();
      expect(groceryEnvelope?.allocatedAmount).toBe(20000);
      expect(groceryEnvelope?.spentAmount).toBe(22000);
      expect(groceryEnvelope?.remainingAmount).toBe(0);
      expect(groceryEnvelope?.isOverrun).toBe(true);
      expect(groceryEnvelope?.utilizationPercentage).toBe(110);

      const utilityEnvelope = result.categories.find((c) => c.category === ExpenseCategory.UTILITIES);
      expect(utilityEnvelope?.isOverrun).toBe(false);
      expect(utilityEnvelope?.remainingAmount).toBe(6000);
      expect(utilityEnvelope?.utilizationPercentage).toBe(40);
    });
  });

  describe('setBudget (Strict Owner Authorization)', () => {
    it('throws ForbiddenException if actor is not an active household member', async () => {
      mockPrisma.homeMember.findUnique.mockResolvedValue(null);

      await expect(
        service.setBudget(homeId, 'intruder', { totalBudget: 50000, month: 10, year: 2026 })
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if actor is a regular MEMBER and not an OWNER', async () => {
      mockPrisma.homeMember.findUnique.mockResolvedValue({
        id: 'm1',
        homeId,
        userId: memberUserId,
        role: MemberRole.MEMBER,
        isActive: true,
      });

      await expect(
        service.setBudget(homeId, memberUserId, { totalBudget: 50000, month: 10, year: 2026 })
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if totalBudget is zero or negative', async () => {
      mockPrisma.homeMember.findUnique.mockResolvedValue({
        id: 'm1',
        homeId,
        userId: ownerUserId,
        role: MemberRole.OWNER,
        isActive: true,
      });

      await expect(
        service.setBudget(homeId, ownerUserId, { totalBudget: 0, month: 10, year: 2026 })
      ).rejects.toThrow(BadRequestException);
    });

    it('allows OWNER to successfully set budget and category envelopes atomically', async () => {
      mockPrisma.homeMember.findUnique.mockResolvedValue({
        id: 'm-owner',
        homeId,
        userId: ownerUserId,
        role: MemberRole.OWNER,
        isActive: true,
      });

      mockPrisma.budget.upsert.mockResolvedValue({
        id: 'budget-new-1',
        homeId,
        year: 2026,
        month: 10,
        totalBudget: '60000',
        createdAt: new Date(),
        updatedAt: new Date(),
        categories: [
          { id: 'bc-1', category: ExpenseCategory.GROCERIES, allocatedAmount: '25000' },
        ],
      });

      mockPrisma.budget.findUnique.mockResolvedValue({
        id: 'budget-new-1',
        homeId,
        year: 2026,
        month: 10,
        totalBudget: '60000',
        createdAt: new Date(),
        updatedAt: new Date(),
        categories: [
          { id: 'bc-1', category: ExpenseCategory.GROCERIES, allocatedAmount: '25000' },
        ],
      });

      mockPrisma.expense.findMany.mockResolvedValue([]);

      const result = await service.setBudget(homeId, ownerUserId, {
        totalBudget: 60000,
        month: 10,
        year: 2026,
        categories: [
          { category: ExpenseCategory.GROCERIES, allocatedAmount: 25000 },
        ],
      });

      expect(mockPrisma.budget.upsert).toHaveBeenCalled();
      expect(mockPrisma.budgetCategory.deleteMany).toHaveBeenCalledWith({ where: { budgetId: 'budget-new-1' } });
      expect(mockPrisma.budgetCategory.createMany).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
      expect(result.hasBudget).toBe(true);
      expect(result.totalBudget).toBe(60000);
    });
  });
});
