import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../auth/auth.service.js';
import { HomesService } from '../homes/homes.service.js';
import { ExpensesService } from '../expenses/expenses.service.js';
import { SettlementsService } from '../settlements/settlements.service.js';
import { HomeMemberGuard } from '../homes/guards/home-member.guard.js';
import { JwtStrategy } from '../auth/strategies/jwt.strategy.js';
import { RateLimiterGuard } from '../auth/guards/rate-limiter.guard.js';
import {
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { MemberRole, AuditAction } from '@homeexpense/shared';
import * as bcrypt from 'bcrypt';

describe('Phase 3: Identity, Access Control & Object-Level Security', () => {
  let mockPrisma: any;
  let mockJwtService: any;
  let mockReflector: any;
  let authService: AuthService;
  let homesService: HomesService;
  let expensesService: ExpensesService;
  let settlementsService: SettlementsService;
  let homeMemberGuard: HomeMemberGuard;
  let jwtStrategy: JwtStrategy;

  const mockUserA = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'usera@household.local',
    name: 'User Alpha',
    passwordHash: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', // Hash of 'CorrectPassword123!'
    emailVerified: true,
    failedLoginAttempts: 0,
    lockoutUntil: null,
    isDeactivated: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserB = {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'userb@household.local',
    name: 'User Beta',
    passwordHash: '$2b$10$hashedpasswordB',
    emailVerified: false,
    failedLoginAttempts: 0,
    lockoutUntil: null,
    isDeactivated: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockHomeId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  beforeEach(() => {
    vi.restoreAllMocks();

    mockPrisma = {
      $transaction: vi.fn(async (cb) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return Promise.all(cb);
      }),
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      session: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      home: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      homeMember: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      expense: {
        findFirst: vi.fn(),
        delete: vi.fn(),
      },
      ledgerEntry: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      settlement: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    };

    mockJwtService = {
      sign: vi.fn().mockReturnValue('mock_jwt_access_token'),
    };

    mockReflector = {
      getAllAndOverride: vi.fn(),
    };

    authService = new AuthService(mockPrisma, mockJwtService);
    homesService = new HomesService(mockPrisma);
    expensesService = new ExpensesService(mockPrisma);
    settlementsService = new SettlementsService(mockPrisma);
    homeMemberGuard = new HomeMemberGuard(mockReflector, mockPrisma);
    jwtStrategy = new JwtStrategy(mockPrisma);
  });

  // =========================================================================
  // NEGATIVE TEST 1: Non-member cannot access Home
  // =========================================================================
  describe('Negative Test: Non-member cannot access Home', () => {
    it('rejects access when user has no membership record in the home', async () => {
      mockPrisma.homeMember.findUnique.mockResolvedValue(null);

      const mockExecutionContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: mockUserA.id },
            params: { homeId: mockHomeId },
          }),
        }),
        getHandler: () => {},
        getClass: () => {},
      };

      await expect(homeMemberGuard.canActivate(mockExecutionContext)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('rejects access when member membership has been deactivated (isActive = false)', async () => {
      mockPrisma.homeMember.findUnique.mockResolvedValue({
        id: 'member-123',
        homeId: mockHomeId,
        userId: mockUserA.id,
        isActive: false,
        role: MemberRole.MEMBER,
      });

      const mockExecutionContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: mockUserA.id },
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
  });

  // =========================================================================
  // NEGATIVE TEST 2: Member cannot call admin-only endpoint
  // =========================================================================
  describe('Negative Test: Member cannot call admin-only endpoint', () => {
    it('guard rejects regular MEMBER from calling endpoint requiring OWNER or ADMIN', async () => {
      mockPrisma.homeMember.findUnique.mockResolvedValue({
        id: 'member-123',
        homeId: mockHomeId,
        userId: mockUserA.id,
        isActive: true,
        role: MemberRole.MEMBER,
        home: { id: mockHomeId },
      });

      mockReflector.getAllAndOverride.mockReturnValue([MemberRole.OWNER, MemberRole.ADMIN]);

      const mockExecutionContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: mockUserA.id },
            params: { homeId: mockHomeId },
          }),
        }),
        getHandler: () => {},
        getClass: () => {},
      };

      await expect(homeMemberGuard.canActivate(mockExecutionContext)).rejects.toThrow(
        'Insufficient role in this home'
      );
    });

    it('service rejects regular MEMBER from altering another member role', async () => {
      mockPrisma.homeMember.findUnique.mockResolvedValue({
        id: 'caller-member-id',
        homeId: mockHomeId,
        userId: mockUserA.id,
        role: MemberRole.MEMBER,
        isActive: true,
      });

      mockPrisma.homeMember.findFirst.mockResolvedValue({
        id: 'target-member-id',
        homeId: mockHomeId,
        role: MemberRole.MEMBER,
        isActive: true,
      });

      await expect(
        homesService.updateMemberRole(mockHomeId, mockUserA.id, 'target-member-id', MemberRole.ADMIN)
      ).rejects.toThrow('Admin-only operation: Regular members cannot alter roles.');
    });

    it('service rejects regular MEMBER from removing another member', async () => {
      mockPrisma.homeMember.findUnique.mockResolvedValue({
        id: 'caller-member-id',
        homeId: mockHomeId,
        userId: mockUserA.id,
        role: MemberRole.MEMBER,
        isActive: true,
      });

      mockPrisma.homeMember.findFirst.mockResolvedValue({
        id: 'target-member-id',
        homeId: mockHomeId,
        userId: mockUserB.id,
        role: MemberRole.MEMBER,
        isActive: true,
      });

      await expect(
        homesService.removeMember(mockHomeId, mockUserA.id, 'target-member-id')
      ).rejects.toThrow('Admin-only operation: Members cannot remove other members.');
    });
  });

  // =========================================================================
  // NEGATIVE TEST 3: Admin cannot perform owner-only operation
  // =========================================================================
  describe('Negative Test: Admin cannot perform owner-only operation', () => {
    it('rejects ADMIN attempting to delete home', async () => {
      mockPrisma.homeMember.findUnique.mockResolvedValue({
        id: 'admin-member-id',
        homeId: mockHomeId,
        userId: mockUserA.id,
        role: MemberRole.ADMIN,
        isActive: true,
      });

      await expect(homesService.deleteHome(mockHomeId, mockUserA.id)).rejects.toThrow(
        'Owner-only operation: Only the Home Owner can delete this home.'
      );
    });

    it('rejects ADMIN attempting to transfer ownership', async () => {
      mockPrisma.homeMember.findUnique.mockResolvedValue({
        id: 'admin-member-id',
        homeId: mockHomeId,
        userId: mockUserA.id,
        role: MemberRole.ADMIN,
        isActive: true,
      });

      await expect(
        homesService.transferOwnership(mockHomeId, mockUserA.id, 'new-owner-id')
      ).rejects.toThrow('Owner-only operation: Only the Home Owner can transfer ownership.');
    });

    it('rejects ADMIN attempting to alter the role of the Home OWNER', async () => {
      mockPrisma.homeMember.findUnique.mockResolvedValue({
        id: 'admin-member-id',
        homeId: mockHomeId,
        userId: mockUserA.id,
        role: MemberRole.ADMIN,
        isActive: true,
      });

      mockPrisma.homeMember.findFirst.mockResolvedValue({
        id: 'owner-member-id',
        homeId: mockHomeId,
        role: MemberRole.OWNER,
        isActive: true,
      });

      await expect(
        homesService.updateMemberRole(mockHomeId, mockUserA.id, 'owner-member-id', MemberRole.MEMBER)
      ).rejects.toThrow('Owner-only operation: Cannot modify role of Home Owner.');
    });

    it('rejects ADMIN attempting to alter the role of another ADMIN', async () => {
      mockPrisma.homeMember.findUnique.mockResolvedValue({
        id: 'admin-member-1',
        homeId: mockHomeId,
        userId: mockUserA.id,
        role: MemberRole.ADMIN,
        isActive: true,
      });

      mockPrisma.homeMember.findFirst.mockResolvedValue({
        id: 'admin-member-2',
        homeId: mockHomeId,
        role: MemberRole.ADMIN,
        isActive: true,
      });

      await expect(
        homesService.updateMemberRole(mockHomeId, mockUserA.id, 'admin-member-2', MemberRole.MEMBER)
      ).rejects.toThrow('Admins cannot alter roles of other Admins.');
    });
  });

  // =========================================================================
  // NEGATIVE TEST 4: Invalid/expired session fails
  // =========================================================================
  describe('Negative Test: Invalid/expired session fails', () => {
    it('rejects refresh when session is revoked (isValid = false)', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-123',
        isValid: false,
        expiresAt: new Date(Date.now() + 100000),
        user: mockUserA,
      });

      await expect(authService.refreshToken('some_revoked_token')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('rejects refresh when session has expired', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-123',
        isValid: true,
        expiresAt: new Date(Date.now() - 1000), // Past
        user: mockUserA,
      });

      mockPrisma.session.update.mockResolvedValue({});

      await expect(authService.refreshToken('expired_token')).rejects.toThrow(
        'Refresh token has expired. Please sign in again.'
      );
    });

    it('password reset invalidates all existing user sessions', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: mockUserA.id,
        passwordResetToken: 'valid-reset-token',
        passwordResetExpires: new Date(Date.now() + 3600000),
      });

      await authService.resetPassword('valid-reset-token', 'BrandNewPassword123!');

      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUserA.id, isValid: true },
        data: { isValid: false },
      });
    });
  });

  // =========================================================================
  // NEGATIVE TEST 5: Deleted / deactivated user cannot perform protected operations
  // =========================================================================
  describe('Negative Test: Deleted/deactivated user cannot perform protected operations', () => {
    it('JwtStrategy rejects deactivated user with UnauthorizedException', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUserA,
        isDeactivated: true,
      });

      await expect(jwtStrategy.validate({ sub: mockUserA.id, email: mockUserA.email })).rejects.toThrow(
        'This account has been deactivated. Please contact support.'
      );
    });

    it('login rejects deactivated user immediately', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUserA,
        isDeactivated: true,
      });

      await expect(
        authService.login({ email: mockUserA.email, password: 'password123' })
      ).rejects.toThrow('This account has been deactivated. Please contact support.');
    });

    it('account deactivation suspends memberships and invalidates all sessions', async () => {
      await authService.deactivateAccount(mockUserA.id);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserA.id },
        data: expect.objectContaining({ isDeactivated: true }),
      });

      expect(mockPrisma.homeMember.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUserA.id },
        data: { isActive: false },
      });

      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUserA.id, isValid: true },
        data: { isValid: false },
      });
    });
  });

  // =========================================================================
  // NEGATIVE TEST 6: Object-Level Security Violations
  // =========================================================================
  describe('Negative Test: Object-Level Security Violations', () => {
    it('rejects regular MEMBER attempting to delete an expense paid by another member', async () => {
      // Caller is User A (regular member)
      mockPrisma.homeMember.findUnique.mockResolvedValue({
        id: 'member-user-a',
        homeId: mockHomeId,
        userId: mockUserA.id,
        role: MemberRole.MEMBER,
        isActive: true,
      });

      // Expense was paid by User B
      mockPrisma.expense.findFirst.mockResolvedValue({
        id: 'expense-123',
        homeId: mockHomeId,
        payer: { userId: mockUserB.id },
        amount: 50.0,
        description: 'Groceries',
      });

      await expect(
        expensesService.deleteExpense(mockHomeId, mockUserA.id, 'expense-123')
      ).rejects.toThrow(
        'Object-level security violation: You can only delete expenses that you paid for unless you are a Home Owner or Admin.'
      );
    });

    it('allows expense payer or OWNER to delete expense', async () => {
      // Caller is payer
      mockPrisma.homeMember.findUnique.mockResolvedValue({
        id: 'member-user-a',
        homeId: mockHomeId,
        userId: mockUserA.id,
        role: MemberRole.MEMBER,
        isActive: true,
      });

      mockPrisma.expense.findFirst.mockResolvedValue({
        id: 'expense-123',
        homeId: mockHomeId,
        payer: { userId: mockUserA.id },
        amount: 50.0,
        description: 'Groceries',
      });

      const result = await expensesService.deleteExpense(mockHomeId, mockUserA.id, 'expense-123');
      expect(result.success).toBe(true);
      expect(mockPrisma.expense.delete).toHaveBeenCalledWith({ where: { id: 'expense-123' } });
    });

    it('rejects unrelated third-party MEMBER from recording a settlement between two other members', async () => {
      // Caller is User A
      mockPrisma.homeMember.findUnique.mockResolvedValue({
        id: 'caller-member-id',
        homeId: mockHomeId,
        userId: mockUserA.id,
        role: MemberRole.MEMBER,
        isActive: true,
      });

      // Settlement is between Member 2 and Member 3 (neither is User A)
      mockPrisma.homeMember.findFirst
        .mockResolvedValueOnce({
          id: 'from-member-id',
          homeId: mockHomeId,
          userId: 'user-3',
          isActive: true,
          user: { name: 'User 3' },
        })
        .mockResolvedValueOnce({
          id: 'to-member-id',
          homeId: mockHomeId,
          userId: 'user-4',
          isActive: true,
          user: { name: 'User 4' },
        });

      await expect(
        settlementsService.createSettlement(mockHomeId, mockUserA.id, {
          fromMemberId: 'from-member-id',
          toMemberId: 'to-member-id',
          amount: 50.0,
        })
      ).rejects.toThrow(
        'Object-level security violation: Only the settlement debtor, creditor, or a Home Admin/Owner can record this settlement.'
      );
    });
  });

  // =========================================================================
  // NEGATIVE TEST 7: Brute-Force Abuse Protection & Rate Limiting
  // =========================================================================
  describe('Brute-Force Lockout & Abuse Protection', () => {
    it('locks out account after 5 consecutive failed login attempts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUserA,
        failedLoginAttempts: 4, // Next fail triggers lockout
      });

      await expect(
        authService.login({ email: mockUserA.email, password: 'wrongpassword' })
      ).rejects.toThrow('Invalid email or password.');

      // Check that lockout was recorded
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserA.id },
        data: expect.objectContaining({
          failedLoginAttempts: 5,
          lockoutUntil: expect.any(Date),
        }),
      });
    });

    it('rejects login attempt if lockout window is active', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUserA,
        failedLoginAttempts: 5,
        lockoutUntil: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes in future
      });

      await expect(
        authService.login({ email: mockUserA.email, password: 'anyPassword' })
      ).rejects.toThrow('Account is temporarily locked due to consecutive failed logins');
    });

    it('RateLimiterGuard throttles after 15 requests in one minute', () => {
      const guard = new RateLimiterGuard();
      const mockReq = { path: '/auth/login', ip: '192.168.1.1', headers: {}, socket: {} };
      const context: any = {
        switchToHttp: () => ({ getRequest: () => mockReq }),
      };

      for (let i = 0; i < 15; i++) {
        expect(guard.canActivate(context)).toBe(true);
      }

      // 16th request must throw 429
      expect(() => guard.canActivate(context)).toThrow(HttpException);
    });
  });
});
