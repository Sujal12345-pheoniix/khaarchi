import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { MemberRole } from '@homeexpense/shared';

@Injectable()
export class HomeMemberGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('Authentication required.');
    }

    const homeId = request.params.homeId || request.body?.homeId;
    if (!homeId) {
      throw new BadRequestException('homeId route parameter or property is missing.');
    }

    const member = await this.prisma.homeMember.findUnique({
      where: {
        homeId_userId: {
          homeId,
          userId: user.id,
        },
      },
      include: {
        home: true,
      },
    });

    if (!member || !member.isActive) {
      throw new ForbiddenException('Access denied: You are not an active member of this Home.');
    }

    // Role checks
    const requiredRoles = this.reflector.getAllAndOverride<MemberRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.includes(member.role as MemberRole);
      if (!hasRole) {
        throw new ForbiddenException(
          `Insufficient role in this home. Required: [${requiredRoles.join(', ')}]. Current role: ${member.role}`
        );
      }
    }

    // Attach verified member and home context to request
    request.member = member;
    request.home = member.home;

    return true;
  }
}
