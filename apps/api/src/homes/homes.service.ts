import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateHomeInput,
  InviteMemberInput,
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

  async inviteMember(homeId: string, actorUserId: string, input: InviteMemberInput) {
    return this.prisma.$transaction(async (tx) => {
      // Check if user exists with this email
      let user = await tx.user.findUnique({
        where: { email: input.email },
      });

      if (!user) {
        // Create an invited user account with temporary password placeholder
        user = await tx.user.create({
          data: {
            email: input.email,
            name: input.email.split('@')[0],
            passwordHash: 'INVITED_USER_PENDING_ACTIVATION',
          },
        });
      }

      // Check existing membership
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

        // Reactivate membership
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
}
