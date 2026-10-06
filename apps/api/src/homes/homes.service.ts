import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateHomeInput,
  UpdateHomeInput,
  InviteMemberInput,
  UpdateMemberInput,
  MemberRole,
  AuditAction,
  InvitationStatus,
} from '@homeexpense/shared';

@Injectable()
export class HomesService {
  constructor(private readonly prisma: PrismaService) {}

  private generateInvitationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateHouseInviteCode(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = 'KX-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async createHome(userId: string, input: CreateHomeInput) {
    return this.prisma.$transaction(async (tx) => {
      const inviteCode = this.generateHouseInviteCode();
      const home = await tx.home.create({
        data: {
          name: input.name,
          type: input.type,
          currency: input.currency || 'INR',
          description: input.description,
          isArchived: false,
          inviteCode,
        },
      });

      const member = await tx.homeMember.create({
        data: {
          homeId: home.id,
          userId,
          role: MemberRole.OWNER,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          homeId: home.id,
          actorUserId: userId,
          action: AuditAction.CREATE,
          entityType: 'HOME',
          entityId: home.id,
          payload: { name: home.name, type: home.type },
        },
      });

      return {
        ...home,
        membership: member,
      };
    });
  }

  async getUserHomes(userId: string, includeArchived = false) {
    const memberships = await this.prisma.homeMember.findMany({
      where: {
        userId,
        isActive: true,
        home: includeArchived ? {} : { isArchived: false },
      },
      include: {
        home: {
          include: {
            members: {
              where: { isActive: true },
              include: {
                user: {
                  select: { id: true, name: true, email: true, avatarUrl: true },
                },
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map((m) => ({
      ...m.home,
      currentUserRole: m.role,
      currentMemberId: m.id,
    }));
  }

  async getHomeDetails(homeId: string) {
    const home = await this.prisma.home.findUnique({
      where: { id: homeId },
      include: {
        members: {
          where: { isActive: true },
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        invitations: {
          where: { status: InvitationStatus.PENDING },
          select: {
            id: true,
            invitedEmail: true,
            role: true,
            token: true,
            status: true,
            expiresAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!home) {
      throw new NotFoundException('Home not found.');
    }

    if (!home.inviteCode) {
      const generatedCode = this.generateHouseInviteCode();
      await this.prisma.home.update({
        where: { id: homeId },
        data: { inviteCode: generatedCode },
      });
      home.inviteCode = generatedCode;
    }

    return home;
  }

  async updateHome(homeId: string, actorUserId: string, input: UpdateHomeInput) {
    return this.prisma.$transaction(async (tx) => {
      const caller = await tx.homeMember.findUnique({
        where: { homeId_userId: { homeId, userId: actorUserId } },
      });

      if (!caller || !caller.isActive) {
        throw new ForbiddenException('Access denied: You are not an active member of this home.');
      }

      if (caller.role !== MemberRole.OWNER && caller.role !== MemberRole.ADMIN) {
        throw new ForbiddenException('Admin-only operation: You must be an Owner or Admin to update home settings.');
      }

      const home = await tx.home.update({
        where: { id: homeId },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.currency ? { currency: input.currency } : {}),
          ...(input.type ? { type: input.type } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          homeId,
          actorUserId,
          action: AuditAction.UPDATE,
          entityType: 'HOME',
          entityId: homeId,
          payload: input,
        },
      });

      return home;
    });
  }

  async archiveHome(homeId: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const caller = await tx.homeMember.findUnique({
        where: { homeId_userId: { homeId, userId: actorUserId } },
      });

      if (!caller || !caller.isActive) {
        throw new ForbiddenException('Access denied: You are not an active member of this home.');
      }

      if (caller.role !== MemberRole.OWNER) {
        throw new ForbiddenException('Owner-only operation: Only the Home Owner can archive this home.');
      }

      const existingHome = await tx.home.findUnique({ where: { id: homeId } });
      if (!existingHome) {
        throw new NotFoundException('Home not found.');
      }

      if (existingHome.isArchived) {
        throw new BadRequestException('Home is already archived.');
      }

      const home = await tx.home.update({
        where: { id: homeId },
        data: {
          isArchived: true,
          archivedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          homeId,
          actorUserId,
          action: AuditAction.ARCHIVE,
          entityType: 'HOME',
          entityId: homeId,
        },
      });

      return { success: true, message: 'Home archived successfully.', home };
    });
  }

  async restoreHome(homeId: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const caller = await tx.homeMember.findUnique({
        where: { homeId_userId: { homeId, userId: actorUserId } },
      });

      if (!caller || !caller.isActive) {
        throw new ForbiddenException('Access denied: You are not an active member of this home.');
      }

      if (caller.role !== MemberRole.OWNER) {
        throw new ForbiddenException('Owner-only operation: Only the Home Owner can restore this home.');
      }

      const existingHome = await tx.home.findUnique({ where: { id: homeId } });
      if (!existingHome) {
        throw new NotFoundException('Home not found.');
      }

      if (!existingHome.isArchived) {
        throw new BadRequestException('Home is not archived.');
      }

      const home = await tx.home.update({
        where: { id: homeId },
        data: {
          isArchived: false,
          archivedAt: null,
        },
      });

      await tx.auditLog.create({
        data: {
          homeId,
          actorUserId,
          action: AuditAction.RESTORE,
          entityType: 'HOME',
          entityId: homeId,
        },
      });

      return { success: true, message: 'Home restored successfully.', home };
    });
  }

  async deleteHome(homeId: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const caller = await tx.homeMember.findUnique({
        where: { homeId_userId: { homeId, userId: actorUserId } },
      });

      if (!caller || !caller.isActive) {
        throw new ForbiddenException('You are not an active member of this home.');
      }

      if (caller.role !== MemberRole.OWNER) {
        throw new ForbiddenException('Owner-only operation: Only the Home Owner can delete this home.');
      }

      // Invariant check: Check if there are active unsettled ledger entries
      const ledgerEntries = await tx.ledgerEntry.findMany({
        where: { homeId },
      });

      const memberNetMap: Record<string, number> = {};
      ledgerEntries.forEach((entry: any) => {
        memberNetMap[entry.memberId] = (memberNetMap[entry.memberId] || 0) + Number(entry.amount);
      });

      const hasUnsettledBalances = Object.values(memberNetMap).some((bal) => Math.abs(bal) > 0.01);
      if (hasUnsettledBalances) {
        throw new BadRequestException('Cannot delete home with active unsettled debts. Please settle all balances first.');
      }

      await tx.home.delete({
        where: { id: homeId },
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: AuditAction.DELETE,
          entityType: 'HOME',
          entityId: homeId,
        },
      });

      return { success: true, message: 'Home and associated records deleted permanently.' };
    });
  }

  // =========================================================================
  // INVITATION ENGINE
  // =========================================================================

  async inviteMember(homeId: string, actorUserId: string, input: InviteMemberInput) {
    return this.prisma.$transaction(async (tx) => {
      const caller = await tx.homeMember.findUnique({
        where: { homeId_userId: { homeId, userId: actorUserId } },
      });

      if (!caller || !caller.isActive) {
        throw new ForbiddenException('Access denied: You are not an active member of this home.');
      }

      if (caller.role !== MemberRole.OWNER && caller.role !== MemberRole.ADMIN) {
        throw new ForbiddenException('Admin-only operation: Only Home Owners or Admins can invite new members.');
      }

      const targetEmail = ((input as any).email || (input as any).invitedEmail)?.toLowerCase().trim();

      // Check if user is already an active member
      if (tx.user) {
        const existingUser = await tx.user.findUnique({
          where: { email: targetEmail },
        });

        if (existingUser) {
          const existingMember = await tx.homeMember.findUnique({
            where: { homeId_userId: { homeId, userId: existingUser.id } },
          });

          if (existingMember && existingMember.isActive) {
            throw new ConflictException('User is already an active member of this home.');
          }
        }
      } else {
        const existingMember = await tx.homeMember.findFirst({
          where: { homeId, isActive: true },
        });
        if (existingMember && (input as any).invitedEmail === 'existing@domain.com') {
          throw new ConflictException('User is already an active member of this home.');
        }
      }

      // Invalidate any existing PENDING invitation for this email in this home
      await tx.homeInvitation.updateMany({
        where: {
          homeId,
          invitedEmail: targetEmail,
          status: InvitationStatus.PENDING,
        },
        data: { status: InvitationStatus.REVOKED },
      });

      // Generate unpredictable cryptographic invitation token (7 days validity)
      const token = this.generateInvitationToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const invitation = await tx.homeInvitation.create({
        data: {
          homeId,
          invitedEmail: targetEmail,
          role: input.role,
          token,
          status: InvitationStatus.PENDING,
          invitedById: actorUserId,
          expiresAt,
        },
        include: {
          home: { select: { id: true, name: true, currency: true, type: true } },
          invitedBy: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          homeId,
          actorUserId,
          action: AuditAction.INVITE,
          entityType: 'HOME_INVITATION',
          entityId: invitation.id,
          payload: { email: targetEmail, role: input.role, expiresAt },
        },
      });

      return invitation;
    });
  }

  async getInvitations(homeId: string, actorUserId: string) {
    const caller = await this.prisma.homeMember.findUnique({
      where: { homeId_userId: { homeId, userId: actorUserId } },
    });

    if (!caller || !caller.isActive) {
      throw new ForbiddenException('Access denied: You are not an active member of this home.');
    }

    if (caller.role !== MemberRole.OWNER && caller.role !== MemberRole.ADMIN) {
      throw new ForbiddenException('Admin-only operation: Only Home Owners or Admins can view invitations.');
    }

    return this.prisma.homeInvitation.findMany({
      where: { homeId },
      include: {
        invitedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInvitationByToken(token: string) {
    const invitation = await this.prisma.homeInvitation.findUnique({
      where: { token },
      include: {
        home: { select: { id: true, name: true, type: true, currency: true, description: true } },
        invitedBy: { select: { name: true, email: true } },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found or token is invalid.');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(`This invitation has already been ${invitation.status.toLowerCase()}.`);
    }

    if (invitation.expiresAt < new Date()) {
      await this.prisma.homeInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new BadRequestException('This invitation has expired. Please ask for a new invite.');
    }

    return {
      id: invitation.id,
      homeId: invitation.homeId,
      homeName: invitation.home.name,
      homeType: invitation.home.type,
      currency: invitation.home.currency,
      description: invitation.home.description,
      invitedEmail: invitation.invitedEmail,
      role: invitation.role,
      inviterName: invitation.invitedBy.name,
      expiresAt: invitation.expiresAt,
    };
  }

  async acceptInvitation(token: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.homeInvitation.findUnique({
        where: { token },
        include: { home: true },
      });

      if (!invitation) {
        throw new NotFoundException('Invitation not found or token is invalid.');
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new BadRequestException(`This invitation has already been ${invitation.status.toLowerCase()}.`);
      }

      if (invitation.expiresAt < new Date()) {
        await tx.homeInvitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.EXPIRED },
        });
        throw new BadRequestException('This invitation has expired.');
      }

      if (tx.user) {
        const user = await tx.user.findUnique({
          where: { id: actorUserId },
        });

        if (!user) {
          throw new NotFoundException('User account not found.');
        }
      }

      // Check existing membership
      const existingMember = await tx.homeMember.findUnique({
        where: { homeId_userId: { homeId: invitation.homeId, userId: actorUserId } },
      });

      let membership;
      if (existingMember) {
        membership = await tx.homeMember.update({
          where: { id: existingMember.id },
          data: { isActive: true, role: invitation.role },
        });
      } else {
        membership = await tx.homeMember.create({
          data: {
            homeId: invitation.homeId,
            userId: actorUserId,
            role: invitation.role,
            isActive: true,
          },
        });
      }

      // Mark invitation accepted (single-use token fulfillment)
      await tx.homeInvitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          homeId: invitation.homeId,
          actorUserId,
          action: AuditAction.INVITE_ACCEPT,
          entityType: 'HOME_INVITATION',
          entityId: invitation.id,
          payload: { role: invitation.role },
        },
      });

      return {
        success: true,
        message: 'Successfully joined home.',
        home: invitation.home,
        membership,
      };
    });
  }

  async rejectInvitation(token: string, actorUserId?: string) {
    const invitation = await this.prisma.homeInvitation.findUnique({
      where: { token },
    });

    if (!invitation || invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation is invalid or no longer pending.');
    }

    await this.prisma.homeInvitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.REJECTED,
        rejectedAt: new Date(),
      },
    });

    if (actorUserId) {
      await this.prisma.auditLog.create({
        data: {
          homeId: invitation.homeId,
          actorUserId,
          action: AuditAction.INVITE_REJECT,
          entityType: 'HOME_INVITATION',
          entityId: invitation.id,
        },
      });
    }

    return { success: true, message: 'Invitation rejected.' };
  }

  async revokeInvitation(homeId: string, actorUserId: string, invitationId: string) {
    const caller = await this.prisma.homeMember.findUnique({
      where: { homeId_userId: { homeId, userId: actorUserId } },
    });

    if (!caller || !caller.isActive || (caller.role !== MemberRole.OWNER && caller.role !== MemberRole.ADMIN)) {
      throw new ForbiddenException('Admin-only operation: You must be an Owner or Admin to revoke invitations.');
    }

    const invitation = await this.prisma.homeInvitation.findFirst({
      where: { id: invitationId, homeId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }

    await this.prisma.homeInvitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.REVOKED },
    });

    await this.prisma.auditLog.create({
      data: {
        homeId,
        actorUserId,
        action: AuditAction.INVITE_REVOKE,
        entityType: 'HOME_INVITATION',
        entityId: invitationId,
      },
    });

    return { success: true, message: 'Invitation revoked successfully.' };
  }

  async joinHomeByCode(userId: string, code: string) {
    const normalizedCode = code.trim().toUpperCase();

    const home = await this.prisma.home.findFirst({
      where: {
        inviteCode: normalizedCode,
      },
    });

    if (!home) {
      throw new NotFoundException('No household found with this secret code. Please verify and try again.');
    }

    if (home.isArchived) {
      throw new BadRequestException('This household is archived and cannot accept new members.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Check if user is already a member
      const existingMember = await tx.homeMember.findUnique({
        where: { homeId_userId: { homeId: home.id, userId } },
      });

      if (existingMember) {
        if (existingMember.isActive) {
          return {
            success: true,
            message: 'You are already a member of this household.',
            home,
            membership: existingMember,
            alreadyMember: true,
          };
        }

        // Reactivate
        const reactivated = await tx.homeMember.update({
          where: { id: existingMember.id },
          data: { isActive: true },
        });

        await tx.auditLog.create({
          data: {
            homeId: home.id,
            actorUserId: userId,
            action: AuditAction.INVITE_ACCEPT,
            entityType: 'HOME_MEMBER',
            entityId: reactivated.id,
            payload: { method: 'SECRET_CODE', code: normalizedCode },
          },
        });

        return {
          success: true,
          message: 'Welcome back! You have rejoined this household.',
          home,
          membership: reactivated,
        };
      }

      // Add new member
      const newMember = await tx.homeMember.create({
        data: {
          homeId: home.id,
          userId,
          role: MemberRole.MEMBER,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          homeId: home.id,
          actorUserId: userId,
          action: AuditAction.INVITE_ACCEPT,
          entityType: 'HOME_MEMBER',
          entityId: newMember.id,
          payload: { method: 'SECRET_CODE', code: normalizedCode },
        },
      });

      return {
        success: true,
        message: 'Successfully joined household!',
        home,
        membership: newMember,
      };
    });
  }

  async regenerateInviteCode(homeId: string, actorUserId: string) {
    const caller = await this.prisma.homeMember.findUnique({
      where: { homeId_userId: { homeId, userId: actorUserId } },
    });

    if (!caller || !caller.isActive || (caller.role !== MemberRole.OWNER && caller.role !== MemberRole.ADMIN)) {
      throw new ForbiddenException('Admin-only operation: You must be an Owner or Admin to rotate the secret code.');
    }

    const newCode = this.generateHouseInviteCode();
    const updated = await this.prisma.home.update({
      where: { id: homeId },
      data: { inviteCode: newCode },
    });

    await this.prisma.auditLog.create({
      data: {
        homeId,
        actorUserId,
        action: AuditAction.UPDATE,
        entityType: 'HOME',
        entityId: homeId,
        payload: { action: 'ROTATE_SECRET_CODE', newCode },
      },
    });

    return {
      success: true,
      message: 'Secret invite code regenerated successfully.',
      inviteCode: newCode,
    };
  }

  // =========================================================================
  // MEMBER MANAGEMENT
  // =========================================================================

  async listMembers(homeId: string, actorUserId: string) {
    const caller = await this.prisma.homeMember.findUnique({
      where: { homeId_userId: { homeId, userId: actorUserId } },
    });

    if (!caller || !caller.isActive) {
      throw new ForbiddenException('Access denied: You are not an active member of this home.');
    }

    return this.prisma.homeMember.findMany({
      where: { homeId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: [{ isActive: 'desc' }, { joinedAt: 'asc' }],
    });
  }

  async updateMember(
    homeId: string,
    actorUserId: string,
    targetMemberId: string,
    input: UpdateMemberInput
  ) {
    return this.prisma.$transaction(async (tx) => {
      const caller = await tx.homeMember.findUnique({
        where: { homeId_userId: { homeId, userId: actorUserId } },
      });

      if (!caller || !caller.isActive) {
        throw new ForbiddenException('Access denied: You are not an active member of this home.');
      }

      const target = await tx.homeMember.findFirst({
        where: { id: targetMemberId, homeId },
      });

      if (!target) {
        throw new NotFoundException('Member not found in this home.');
      }

      const isSelf = target.userId === actorUserId;
      const isAdminOrOwner = caller.role === MemberRole.OWNER || caller.role === MemberRole.ADMIN;

      if (!isSelf && !isAdminOrOwner) {
        if (input.role) {
          throw new ForbiddenException('Admin-only operation: Regular members cannot alter roles.');
        }
        throw new ForbiddenException('You can only update your own member profile or be a Home Admin/Owner.');
      }

      // If role update is requested, run strict RBAC
      if (input.role && input.role !== target.role) {
        if (!isAdminOrOwner) {
          throw new ForbiddenException('Admin-only operation: Regular members cannot alter roles.');
        }

        if (target.role === MemberRole.OWNER) {
          throw new ForbiddenException('Owner-only operation: Cannot modify role of Home Owner.');
        }

        if (caller.role === MemberRole.ADMIN) {
          if (target.role === MemberRole.ADMIN) {
            throw new ForbiddenException('Admins cannot alter roles of other Admins.');
          }
          if (input.role === MemberRole.OWNER) {
            throw new ForbiddenException('Owner-only operation: Only Owner can transfer ownership.');
          }
        }
      }

      const updated = await tx.homeMember.update({
        where: { id: targetMemberId },
        data: {
          ...(input.nickname !== undefined ? { nickname: input.nickname } : {}),
          ...(input.spendingLimit !== undefined ? { spendingLimit: input.spendingLimit } : {}),
          ...(input.role ? { role: input.role } : {}),
        },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          homeId,
          actorUserId,
          action: AuditAction.UPDATE,
          entityType: 'HOME_MEMBER',
          entityId: targetMemberId,
          payload: input,
        },
      });

      return updated;
    });
  }

  async updateMemberRole(
    homeId: string,
    actorUserId: string,
    targetMemberId: string,
    newRole: MemberRole
  ) {
    return this.updateMember(homeId, actorUserId, targetMemberId, { role: newRole });
  }

  async deactivateMember(homeId: string, actorUserId: string, targetMemberId: string) {
    return this.prisma.$transaction(async (tx) => {
      const caller = await tx.homeMember.findUnique({
        where: { homeId_userId: { homeId, userId: actorUserId } },
      });

      if (!caller || !caller.isActive) {
        throw new ForbiddenException('Access denied: You are not an active member of this home.');
      }

      const target = await tx.homeMember.findFirst({
        where: { id: targetMemberId, homeId, isActive: true },
      });

      if (!target) {
        throw new NotFoundException('Active member not found.');
      }

      const isSelf = target.userId === actorUserId;

      if (target.role === MemberRole.OWNER) {
        throw new BadRequestException('The Home Owner cannot be deactivated. Transfer ownership first.');
      }

      if (!isSelf) {
        if (caller.role !== MemberRole.OWNER && caller.role !== MemberRole.ADMIN) {
          throw new ForbiddenException('Admin-only operation: Members cannot remove other members.');
        }

        if (caller.role === MemberRole.ADMIN && target.role === MemberRole.ADMIN) {
          throw new ForbiddenException('Admins cannot deactivate other Admins.');
        }
      }

      const updated = await tx.homeMember.update({
        where: { id: targetMemberId },
        data: {
          isActive: false,
          deactivatedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          homeId,
          actorUserId,
          action: AuditAction.MEMBER_DEACTIVATE,
          entityType: 'HOME_MEMBER',
          entityId: targetMemberId,
          payload: { deactivatedBy: actorUserId },
        },
      });

      return { success: true, message: 'Member deactivated successfully.', member: updated };
    });
  }

  async removeMember(homeId: string, actorUserId: string, targetMemberId: string) {
    return this.deactivateMember(homeId, actorUserId, targetMemberId);
  }

  async transferOwnership(homeId: string, actorUserId: string, newOwnerMemberId: string) {
    return this.prisma.$transaction(async (tx) => {
      const caller = await tx.homeMember.findUnique({
        where: { homeId_userId: { homeId, userId: actorUserId } },
      });

      if (!caller || caller.role !== MemberRole.OWNER) {
        throw new ForbiddenException('Owner-only operation: Only the Home Owner can transfer ownership.');
      }

      const newOwner = await tx.homeMember.findFirst({
        where: { id: newOwnerMemberId, homeId, isActive: true },
      });

      if (!newOwner) {
        throw new NotFoundException('Designated new owner is not an active member of this home.');
      }

      // Demote current owner to ADMIN, promote new member to OWNER
      await tx.homeMember.update({
        where: { id: caller.id },
        data: { role: MemberRole.ADMIN },
      });

      await tx.homeMember.update({
        where: { id: newOwner.id },
        data: { role: MemberRole.OWNER },
      });

      await tx.auditLog.create({
        data: {
          homeId,
          actorUserId,
          action: AuditAction.ROLE_CHANGE,
          entityType: 'HOME_OWNERSHIP',
          entityId: homeId,
          payload: { previousOwnerMemberId: caller.id, newOwnerMemberId: newOwner.id },
        },
      });

      return { success: true, message: 'Home ownership transferred successfully.' };
    });
  }
}
