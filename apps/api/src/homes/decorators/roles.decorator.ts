import { SetMetadata } from '@nestjs/common';
import { MemberRole } from '@homeexpense/shared';

export const ROLES_KEY = 'roles';
export const RequireRoles = (...roles: MemberRole[]) => SetMetadata(ROLES_KEY, roles);
