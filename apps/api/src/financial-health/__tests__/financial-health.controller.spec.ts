import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinancialHealthController } from '../financial-health.controller.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { HomeMemberGuard } from '../../homes/guards/home-member.guard.js';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

describe('FinancialHealthController & Security', () => {
  let controller: FinancialHealthController;
  let mockService: any;
  let mockSnapshotService: any;
  let mockPrisma: any;
  let mockReflector: any;
  let homeMemberGuard: HomeMemberGuard;

  const mockUserId = 'user-1111-2222-3333-4444';
  const mockHomeId = 'home-aaaa-bbbb-cccc-dddd';
  const foreignHomeId = 'home-9999-8888-7777-6666';

  beforeEach(() => {
    mockService = {
      evaluateHomeHealth: vi.fn(),
    };
    mockSnapshotService = {
      getSnapshotHistory: vi.fn(),
    };
    controller = new FinancialHealthController(mockService, mockSnapshotService);

    mockPrisma = {
      homeMember: {
        findUnique: vi.fn(),
      },
    };
    mockReflector = {
      getAllAndOverride: vi.fn().mockReturnValue(null),
    };
    homeMemberGuard = new HomeMemberGuard(mockReflector, mockPrisma);
  });

  describe('Route Metadata & Declarative Protection', () => {
    it('has JwtAuthGuard and HomeMemberGuard applied to protect the route', () => {
      const guards = Reflect.getMetadata('__guards__', FinancialHealthController);
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(HomeMemberGuard);
    });

    it('delegates evaluateHomeHealth with the route homeId', async () => {
      mockService.evaluateHomeHealth.mockResolvedValue({
        score: 85,
        status: 'HEALTHY',
      });

      const result = await controller.getFinancialHealth(mockHomeId);

      expect(mockService.evaluateHomeHealth).toHaveBeenCalledWith(mockHomeId);
      expect(result.score).toBe(85);
    });

    it('delegates history request to snapshot service', async () => {
      mockSnapshotService.getSnapshotHistory.mockResolvedValue([
        { id: 'snap-1', score: 80 },
      ]);

      const result = await controller.getHealthHistory(mockHomeId);

      expect(mockSnapshotService.getSnapshotHistory).toHaveBeenCalledWith(mockHomeId);
      expect(result).toHaveLength(1);
    });
  });

  describe('Multi-Tenant Cross-Home Isolation Enforcement', () => {
    it('blocks access when user attempts to query a foreign home they do not belong to', async () => {
      // User is not found in the foreign home
      mockPrisma.homeMember.findUnique.mockResolvedValue(null);

      const mockExecutionContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: mockUserId },
            params: { homeId: foreignHomeId },
          }),
        }),
        getHandler: () => {},
        getClass: () => {},
      };

      await expect(homeMemberGuard.canActivate(mockExecutionContext)).rejects.toThrow(
        ForbiddenException
      );
      await expect(homeMemberGuard.canActivate(mockExecutionContext)).rejects.toThrow(
        'Access denied: You are not an active member of this Home.'
      );
    });

    it('blocks unauthenticated requests with missing user context', async () => {
      const mockExecutionContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: null,
            params: { homeId: mockHomeId },
          }),
        }),
        getHandler: () => {},
        getClass: () => {},
      };

      await expect(homeMemberGuard.canActivate(mockExecutionContext)).rejects.toThrow(
        'Authentication required.'
      );
    });

    it('blocks deactivated members from querying household financial health', async () => {
      mockPrisma.homeMember.findUnique.mockResolvedValue({
        id: 'member-deactivated',
        homeId: mockHomeId,
        userId: mockUserId,
        isActive: false, // Deactivated member
        role: 'MEMBER',
      });

      const mockExecutionContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: mockUserId },
            params: { homeId: mockHomeId },
          }),
        }),
        getHandler: () => {},
        getClass: () => {},
      };

      await expect(homeMemberGuard.canActivate(mockExecutionContext)).rejects.toThrow(
        'Access denied: You are not an active member of this Home.'
      );
    });

    it('allows active members and attaches member and home context to request', async () => {
      const mockMember = {
        id: 'member-active-1',
        homeId: mockHomeId,
        userId: mockUserId,
        isActive: true,
        role: 'MEMBER',
        home: { id: mockHomeId, name: 'Our Household', type: 'FAMILY' },
      };
      mockPrisma.homeMember.findUnique.mockResolvedValue(mockMember);

      const mockReq: any = {
        user: { id: mockUserId },
        params: { homeId: mockHomeId },
      };
      const mockExecutionContext: any = {
        switchToHttp: () => ({
          getRequest: () => mockReq,
        }),
        getHandler: () => {},
        getClass: () => {},
      };

      const canActivate = await homeMemberGuard.canActivate(mockExecutionContext);
      expect(canActivate).toBe(true);
      expect(mockReq.member).toEqual(mockMember);
      expect(mockReq.home).toEqual(mockMember.home);
    });

    it('rejects requests missing homeId parameter', async () => {
      const mockExecutionContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: mockUserId },
            params: {},
          }),
        }),
        getHandler: () => {},
        getClass: () => {},
      };

      await expect(homeMemberGuard.canActivate(mockExecutionContext)).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
