import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateHomeInput,
  InviteMemberInput,
  UpdateMemberRoleInput,
  MemberRole,
  AuditAction,
} from '@homeexpense/shared';

@Injectable()
export class HomesService {
  constructor(private readonly prisma: PrismaService) {}

  async createHome(userId: string, input: CreateHomeInput) {
    return this.prisma.$transaction(async (tx) => {
      const home = await tx.home.create({
        data: {
          name: input.name,
          type: input.type,
          currency: input.currency || 'INR',
          description: input.description,
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

  async getUserHomes(userId: string) {
    const memberships = await this.prisma.homeMember.findMany({
      where: { userId, isActive: true },
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
      },
    });

    if (!home) {
      throw new NotFoundException('Home not found.');
    }

    return home;
  }

  async updateHome(homeId: string, actorUserId: string, data: { name?: string; description?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const home = await tx.home.update({
        where: { id: homeId },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          homeId,
          actorUserId,
          action: AuditAction.UPDATE,
          entityType: 'HOME',
          entityId: homeId,
          payload: data,
        },
      });

      return home;
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

  async inviteMember(homeId: string, actorUserId: string, input: InviteMemberInput) {
    return this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({
        where: { email: input.email },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            email: input.email,
            name: input.email.split('@')[0],
            passwordHash: 'INVITED_USER_PENDING_ACTIVATION',
          },
        });
      }

      const existingMember = await tx.homeMember.findUnique({
        where: {
          homeId_userId: {
            homeId,
            userId: user.id,
          },
        },
      });

      if (existingMember) {
        if (existingMember.isActive) {
          throw new ConflictException('User is already an active member of this home.');
        }

        const reactivated = await tx.homeMember.update({
          where: { id: existingMember.id },
          data: { isActive: true, role: input.role },
        });

        await tx.auditLog.create({
          data: {
            homeId,
            actorUserId,
            action: AuditAction.ROLE_CHANGE,
            entityType: 'HOME_MEMBER',
            entityId: reactivated.id,
            payload: { role: input.role, reactivated: true },
          },
        });

        return reactivated;
      }

      const member = await tx.homeMember.create({
        data: {
          homeId,
          userId: user.id,
          role: input.role,
          isActive: true,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          homeId,
          actorUserId,
          action: AuditAction.INVITE,
          entityType: 'HOME_MEMBER',
          entityId: member.id,
          payload: { email: input.email, role: input.role },
        },
      });

      return member;
    });
  }

  async updateMemberRole(
    homeId: string,
    actorUserId: string,
    targetMemberId: string,
    newRole: MemberRole
  ) {
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
        throw new NotFoundException('Target member not found in this home.');
      }

      // Rule: Member cannot call role change
      if (caller.role === MemberRole.MEMBER || caller.role === MemberRole.VIEWER) {
        throw new ForbiddenException('Admin-only operation: Regular members cannot alter roles.');
      }

      // Rule: Target is Owner -> cannot demote owner without ownership transfer
      if (target.role === MemberRole.OWNER) {
        throw new ForbiddenException('Owner-only operation: Cannot modify role of Home Owner.');
      }

      // Rule: Admin cannot modify another Admin or promote to Owner
      if (caller.role === MemberRole.ADMIN) {
        if (target.role === MemberRole.ADMIN) {
          throw new ForbiddenException('Admins cannot alter roles of other Admins.');
        }
        if (newRole === MemberRole.OWNER) {
          throw new ForbiddenException('Owner-only operation: Only Owner can transfer ownership.');
        }
      }

      const updated = await tx.homeMember.update({
        where: { id: targetMemberId },
        data: { role: newRole },
      });

      await tx.auditLog.create({
        data: {
          homeId,
          actorUserId,
          action: AuditAction.ROLE_CHANGE,
          entityType: 'HOME_MEMBER',
          entityId: targetMemberId,
          payload: { oldRole: target.role, newRole },
        },
      });

      return updated;
    });
  }

  async removeMember(homeId: string, actorUserId: string, targetMemberId: string) {
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
        throw new NotFoundException('Target member not found in this home.');
      }

      // Self-removal is allowed for non-owners
      const isSelf = target.userId === actorUserId;

      if (target.role === MemberRole.OWNER) {
        throw new BadRequestException('The Home Owner cannot be removed. Transfer ownership first.');
      }

      if (!isSelf) {
        if (caller.role === MemberRole.MEMBER || caller.role === MemberRole.VIEWER) {
          throw new ForbiddenException('Admin-only operation: Members cannot remove other members.');
        }

        if (caller.role === MemberRole.ADMIN && target.role === MemberRole.ADMIN) {
          throw new ForbiddenException('Admins cannot remove other Admins.');
        }
      }

      const updated = await tx.homeMember.update({
        where: { id: targetMemberId },
        data: { isActive: false },
      });

      await tx.auditLog.create({
        data: {
          homeId,
          actorUserId,
          action: AuditAction.DELETE,
          entityType: 'HOME_MEMBER',
          entityId: targetMemberId,
          payload: { removedBy: actorUserId },
        },
      });

      return { success: true, message: 'Member removed from home successfully.' };
    });
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
