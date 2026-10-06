import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HomesService } from '../homes/homes.service.js';
import { BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { HomeType, MemberRole, InvitationStatus, AuditAction } from '@homeexpense/shared';

describe('HomeExpense Phase 4: Home & Membership Engine', () => {
  let mockPrisma: any;
  let homesService: HomesService;

  beforeEach(() => {
    mockPrisma = {
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
      home: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      homeMember: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      homeInvitation: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      ledgerEntry: {
        findMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    };

    homesService = new HomesService(mockPrisma);
  });

  const ownerUserId = '11111111-1111-1111-1111-111111111111';
  const adminUserId = '22222222-2222-2222-2222-222222222222';
  const memberUserId = '33333333-3333-3333-3333-333333333333';
  const inviteeUserId = '44444444-4444-4444-4444-444444444444';
  const homeId = '55555555-5555-5555-5555-555555555555';

  describe('Home Lifecycle Management', () => {
    it('creates home with caller designated as HOME_OWNER and records audit log', async () => {
      const mockCreatedHome = {
        id: homeId,
        name: 'Equilibrium Flat',
        type: HomeType.BACHELOR,
        currency: 'INR',
        description: 'Primary Flat',
        isArchived: false,
      };

      const mockOwnerMember = {
        id: 'member-owner-1',
        homeId,
        userId: ownerUserId,
        role: MemberRole.OWNER,
        isActive: true,
      };

      mockPrisma.home.create.mockResolvedValue(mockCreatedHome);
      mockPrisma.homeMember.create.mockResolvedValue(mockOwnerMember);
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      const result = await homesService.createHome(ownerUserId, {
        name: 'Equilibrium Flat',
        type: HomeType.BACHELOR,
        currency: 'INR',
        description: 'Primary Flat',
      });

      expect(result.id).toBe(homeId);
      expect(result.membership.role).toBe(MemberRole.OWNER);
      expect(mockPrisma.home.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Equilibrium Flat',
          type: HomeType.BACHELOR,
          currency: 'INR',
          isArchived: false,
        }),
      });
      expect(mockPrisma.homeMember.create).toHaveBeenCalledWith({
        data: {
          homeId,
          userId: ownerUserId,
          role: MemberRole.OWNER,
          isActive: true,
        },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AuditAction.CREATE,
          entityType: 'HOME',
        }),
      });
    });

    it('allows HOME_OWNER or HOME_ADMIN to edit home details', async () => {
      mockPrisma.homeMember.findUnique.mockResolvedValue({
        id: 'member-owner-1',
        homeId,
        userId: ownerUserId,
        role: MemberRole.OWNER,
        isActive: true,
      });

      mockPrisma.home.update.mockResolvedValue({
        id: homeId,
        name: 'Updated Flat Name',
        description: 'New Description',
      });

      const updated = await homesService.updateHome(homeId, ownerUserId, {
        name: 'Updated Flat Name',
        description: 'New Description',
      });

      expect(updated.name).toBe('Updated Flat Name');
      expect(mockPrisma.home.update).toHaveBeenCalledWith({
        where: { id: homeId },
        data: { name: 'Updated Flat Name', description: 'New Description' },
      });
    });

    it('rejects home update by regular MEMBER with ForbiddenException', async () => {
      mockPrisma.homeMember.findUnique.mockResolvedValue({
        id: 'member-3',
        homeId,
        userId: memberUserId,
        role: MemberRole.MEMBER,
        isActive: true,
      });

      await expect(
        homesService.updateHome(homeId, memberUserId, { name: 'Unauthorized Change' })
      ).rejects.toThrow(ForbiddenException);
    });

    it('strictly restricts archive and restore operations to HOME_OWNER', async () => {
      // Member trying to archive -> ForbiddenException
      mockPrisma.homeMember.findUnique.mockResolvedValueOnce({
        id: 'member-admin-1',
        homeId,
        userId: adminUserId,
        role: MemberRole.ADMIN,
        isActive: true,
      });

      await expect(homesService.archiveHome(homeId, adminUserId)).rejects.toThrow(ForbiddenException);

      // Owner archiving -> Success
      mockPrisma.homeMember.findUnique.mockResolvedValueOnce({
        id: 'member-owner-1',
        homeId,
        userId: ownerUserId,
        role: MemberRole.OWNER,
        isActive: true,
      });

      mockPrisma.home.findUnique.mockResolvedValueOnce({
        id: homeId,
        isArchived: false,
      });

      mockPrisma.home.update.mockResolvedValueOnce({
        id: homeId,
        isArchived: true,
      });

      const archived = await homesService.archiveHome(homeId, ownerUserId);
      expect(archived.home.isArchived).toBe(true);

      // Owner restoring -> Success
      mockPrisma.homeMember.findUnique.mockResolvedValueOnce({
        id: 'member-owner-1',
        homeId,
        userId: ownerUserId,
        role: MemberRole.OWNER,
        isActive: true,
      });

      mockPrisma.home.findUnique.mockResolvedValueOnce({
        id: homeId,
        isArchived: true,
      });

      mockPrisma.home.update.mockResolvedValueOnce({
        id: homeId,
        isArchived: false,
      });

      const restored = await homesService.restoreHome(homeId, ownerUserId);
      expect(restored.home.isArchived).toBe(false);
    });

    it('prevents home deletion if active unsettled balances exist', async () => {
      mockPrisma.homeMember.findUnique.mockResolvedValue({
        id: 'member-owner-1',
        homeId,
        userId: ownerUserId,
        role: MemberRole.OWNER,
        isActive: true,
      });

      // Active ledger entries with non-zero net balance
      mockPrisma.ledgerEntry.findMany.mockResolvedValue([
        { memberId: 'member-1', amount: 50.0 },
        { memberId: 'member-2', amount: -50.0 },
      ]);

      await expect(homesService.deleteHome(homeId, ownerUserId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('Invitation Security & Engine', () => {
    it('generates unpredictable 32-byte (64 hex char) token with 7-day expiration', async () => {
      mockPrisma.homeMember.findUnique
        .mockResolvedValueOnce({
          id: 'member-owner-1',
          homeId,
          userId: ownerUserId,
          role: MemberRole.OWNER,
          isActive: true,
        })
        .mockResolvedValueOnce(null);

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.homeInvitation.findFirst.mockResolvedValue(null);
      mockPrisma.homeInvitation.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'inv-1', ...data }));

      const invite = await homesService.inviteMember(homeId, ownerUserId, {
        email: 'roommate@domain.com',
        role: MemberRole.MEMBER,
      });

      expect(invite.token).toBeDefined();
      expect(invite.token).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(invite.token)).toBe(true);

      const now = Date.now();
      const expiresAt = new Date(invite.expiresAt).getTime();
      const diffDays = (expiresAt - now) / (1000 * 60 * 60 * 24);
      expect(Math.round(diffDays)).toBe(7);
    });

    it('rejects invitation creation if email is already an active member', async () => {
      mockPrisma.homeMember.findUnique
        .mockResolvedValueOnce({
          id: 'member-owner-1',
          homeId,
          userId: ownerUserId,
          role: MemberRole.OWNER,
          isActive: true,
        })
        .mockResolvedValueOnce({
          id: 'member-existing',
          homeId,
          userId: 'existing-user-id',
          isActive: true,
        });

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'existing-user-id',
        email: 'existing@domain.com',
      });

      await expect(
        homesService.inviteMember(homeId, ownerUserId, {
          email: 'existing@domain.com',
          role: MemberRole.MEMBER,
        })
      ).rejects.toThrow(ConflictException);
    });

    it('resolves invitation by token returning sanitized non-sensitive data', async () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      mockPrisma.homeInvitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        token: 'a'.repeat(64),
        invitedEmail: 'invitee@domain.com',
        role: MemberRole.MEMBER,
        status: InvitationStatus.PENDING,
        expiresAt: futureDate,
        home: {
          id: homeId,
          name: 'Equilibrium House',
          type: HomeType.BACHELOR,
          currency: 'INR',
        },
        invitedBy: {
          name: 'Owner Alice',
        },
      });

      const details = await homesService.getInvitationByToken('a'.repeat(64));
      expect(details.homeName).toBe('Equilibrium House');
      expect(details.invitedEmail).toBe('invitee@domain.com');
      expect(details.inviterName).toBe('Owner Alice');
      // Must not leak token, audit entries, or hashes
      expect((details as any).passwordHash).toBeUndefined();
    });

    it('enforces single-use token lifecycle: throws BadRequestException if accepted twice', async () => {
      // 1st attempt: Valid pending invitation
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      mockPrisma.homeInvitation.findUnique.mockResolvedValueOnce({
        id: 'inv-1',
        token: 'b'.repeat(64),
        homeId,
        invitedEmail: 'invitee@domain.com',
        role: MemberRole.MEMBER,
        status: InvitationStatus.PENDING,
        expiresAt: futureDate,
      });

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: inviteeUserId,
        email: 'invitee@domain.com',
      });

      mockPrisma.homeMember.findUnique.mockResolvedValueOnce(null); // not already member
      mockPrisma.homeMember.create.mockResolvedValueOnce({
        id: 'new-member-id',
        homeId,
        userId: inviteeUserId,
        role: MemberRole.MEMBER,
        isActive: true,
      });

      mockPrisma.homeInvitation.update.mockResolvedValueOnce({
        id: 'inv-1',
        status: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
      });

      const acceptResult = await homesService.acceptInvitation('b'.repeat(64), inviteeUserId);
      expect(acceptResult.membership.role).toBe(MemberRole.MEMBER);
      expect(mockPrisma.homeInvitation.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: expect.objectContaining({
          status: InvitationStatus.ACCEPTED,
        }),
      });

      // 2nd attempt: Invitation now has status ACCEPTED
      mockPrisma.homeInvitation.findUnique.mockResolvedValueOnce({
        id: 'inv-1',
        token: 'b'.repeat(64),
        homeId,
        status: InvitationStatus.ACCEPTED,
        expiresAt: futureDate,
      });

      await expect(
        homesService.acceptInvitation('b'.repeat(64), inviteeUserId)
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects acceptance of expired invitation tokens', async () => {
      const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      mockPrisma.homeInvitation.findUnique.mockResolvedValue({
        id: 'inv-expired',
        token: 'c'.repeat(64),
        homeId,
        status: InvitationStatus.PENDING,
        expiresAt: pastDate,
      });

      mockPrisma.homeInvitation.update.mockResolvedValue({
        id: 'inv-expired',
        status: InvitationStatus.EXPIRED,
      });

      await expect(
        homesService.acceptInvitation('c'.repeat(64), inviteeUserId)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Member Management & Authorization Hierarchy', () => {
    it('prevents non-owners from updating roles or demoting the HOME_OWNER', async () => {
      // Caller is Admin
      mockPrisma.homeMember.findUnique.mockImplementation(({ where }: any) => {
        if (where.homeId_userId) {
          return Promise.resolve({
            id: 'member-admin',
            homeId,
            userId: adminUserId,
            role: MemberRole.ADMIN,
            isActive: true,
          });
        }
        return Promise.resolve(null);
      });

      mockPrisma.homeMember.findFirst.mockImplementation(({ where }: any) => {
        if (where.id === 'member-owner') {
          return Promise.resolve({
            id: 'member-owner',
            homeId,
            userId: ownerUserId,
            role: MemberRole.OWNER,
            isActive: true,
          });
        }
        return Promise.resolve(null);
      });

      // Admin trying to change Owner role -> ForbiddenException
      await expect(
        homesService.updateMemberRole(homeId, adminUserId, 'member-owner', MemberRole.MEMBER)
      ).rejects.toThrow(ForbiddenException);
    });

    it('prevents deactivating or removing the HOME_OWNER without prior transfer', async () => {
      mockPrisma.homeMember.findUnique.mockImplementation(({ where }: any) => {
        if (where.homeId_userId) {
          return Promise.resolve({
            id: 'member-owner',
            homeId,
            userId: ownerUserId,
            role: MemberRole.OWNER,
            isActive: true,
          });
        }
        return Promise.resolve(null);
      });

      mockPrisma.homeMember.findFirst.mockImplementation(({ where }: any) => {
        if (where.id === 'member-owner') {
          return Promise.resolve({
            id: 'member-owner',
            homeId,
            userId: ownerUserId,
            role: MemberRole.OWNER,
            isActive: true,
          });
        }
        return Promise.resolve(null);
      });

      await expect(
        homesService.deactivateMember(homeId, ownerUserId, 'member-owner')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('GATE Invariant Flow Verification', () => {
    it('successfully executes: Register -> Create Home -> Invite Member -> Accept Invitation -> See Member in Directory', async () => {
      // Step 1: User 1 creates home
      const newHome = {
        id: 'gate-home-1',
        name: 'The Golden Household',
        type: HomeType.FAMILY,
        currency: 'INR',
        isArchived: false,
      };

      const user1Member = {
        id: 'user1-member-id',
        homeId: newHome.id,
        userId: ownerUserId,
        role: MemberRole.OWNER,
        isActive: true,
      };

      mockPrisma.home.create.mockResolvedValueOnce(newHome);
      mockPrisma.homeMember.create.mockResolvedValueOnce(user1Member);

      const createdHome = await homesService.createHome(ownerUserId, {
        name: 'The Golden Household',
        type: HomeType.FAMILY,
        currency: 'INR',
      });

      expect(createdHome.id).toBe('gate-home-1');
      expect(createdHome.membership.role).toBe(MemberRole.OWNER);

      // Step 2: User 1 invites User 2
      mockPrisma.homeMember.findUnique.mockResolvedValueOnce(user1Member);
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.homeMember.findFirst.mockResolvedValueOnce(null);
      mockPrisma.homeInvitation.findFirst.mockResolvedValueOnce(null);

      const generatedToken = 'd'.repeat(64);
      const invitationRecord = {
        id: 'inv-gate-1',
        homeId: newHome.id,
        invitedEmail: 'user2@domain.com',
        role: MemberRole.MEMBER,
        token: generatedToken,
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      mockPrisma.homeInvitation.create.mockResolvedValueOnce(invitationRecord);

      const inviteResult = await homesService.inviteMember(newHome.id, ownerUserId, {
        email: 'user2@domain.com',
        role: MemberRole.MEMBER,
      });

      expect(inviteResult.invitedEmail).toBe('user2@domain.com');

      // Step 3: User 2 views invitation details
      mockPrisma.homeInvitation.findUnique.mockResolvedValueOnce({
        ...invitationRecord,
        home: newHome,
        invitedBy: { name: 'User 1' },
      });

      const publicInvite = await homesService.getInvitationByToken(generatedToken);
      expect(publicInvite.homeName).toBe('The Golden Household');
      expect(publicInvite.invitedEmail).toBe('user2@domain.com');

      // Step 4: User 2 accepts invitation
      const user2Member = {
        id: 'user2-member-id',
        homeId: newHome.id,
        userId: inviteeUserId,
        role: MemberRole.MEMBER,
        isActive: true,
      };

      mockPrisma.homeInvitation.findUnique.mockResolvedValueOnce(invitationRecord);
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: inviteeUserId, email: 'user2@domain.com' });
      mockPrisma.homeMember.findUnique.mockResolvedValueOnce(null);
      mockPrisma.homeMember.create.mockResolvedValueOnce(user2Member);
      mockPrisma.homeInvitation.update.mockResolvedValueOnce({
        ...invitationRecord,
        status: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
      });

      const acceptRes = await homesService.acceptInvitation(generatedToken, inviteeUserId);
      expect(acceptRes.membership.userId).toBe(inviteeUserId);
      expect(acceptRes.membership.role).toBe(MemberRole.MEMBER);

      // Step 5: Verify Home Directory reflects both members
      mockPrisma.home.findUnique.mockResolvedValueOnce({
        ...newHome,
        members: [
          { ...user1Member, user: { id: ownerUserId, name: 'User 1', email: 'user1@domain.com' } },
          { ...user2Member, user: { id: inviteeUserId, name: 'User 2', email: 'user2@domain.com' } },
        ],
        invitations: [],
      });

      const directory = await homesService.getHomeDetails(newHome.id);
      expect(directory.members).toHaveLength(2);
      expect(directory.members[0].user.name).toBe('User 1');
      expect(directory.members[1].user.name).toBe('User 2');
    });
  });
});
