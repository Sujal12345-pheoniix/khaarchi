import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CashflowController } from '../cashflow.controller.js';
import { CashflowService } from '../cashflow.service.js';

describe('CashflowController', () => {
  let controller: CashflowController;
  let mockCashflowService: any;

  const homeId = 'home-1111-2222-3333-4444';
  const ownerUser = { id: 'user-owner-1111' };

  beforeEach(() => {
    mockCashflowService = {
      getSafeToSpend: vi.fn(),
      updateProtectedReserve: vi.fn(),
    };

    controller = new CashflowController(
      mockCashflowService as unknown as CashflowService
    );
  });

  describe('getSafeToSpend', () => {
    it('delegates homeId to CashflowService.getSafeToSpend', async () => {
      const mockResult = {
        homeId,
        safeToSpend: 25000,
        status: 'HEALTHY',
      };
      mockCashflowService.getSafeToSpend.mockResolvedValue(mockResult);

      const result = await controller.getSafeToSpend(homeId);

      expect(mockCashflowService.getSafeToSpend).toHaveBeenCalledWith(homeId);
      expect(result).toBe(mockResult);
    });
  });

  describe('updateProtectedReserve', () => {
    it('delegates homeId, userId, and amount to CashflowService.updateProtectedReserve', async () => {
      const mockResult = { homeId, protectedReserve: 8000 };
      mockCashflowService.updateProtectedReserve.mockResolvedValue(mockResult);

      const result = await controller.updateProtectedReserve(homeId, ownerUser, {
        protectedReserve: 8000,
      });

      expect(mockCashflowService.updateProtectedReserve).toHaveBeenCalledWith(
        homeId,
        ownerUser.id,
        8000
      );
      expect(result).toBe(mockResult);
    });
  });
});
