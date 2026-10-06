import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { HomesService } from './homes.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { HomeMemberGuard } from './guards/home-member.guard.js';
import { RequireRoles } from './decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import {
  CreateHomeSchema,
  UpdateHomeSchema,
  InviteMemberSchema,
  JoinHomeByCodeSchema,
  UpdateMemberRoleSchema,
  UpdateMemberSchema,
  CreateHomeInput,
  UpdateHomeInput,
  InviteMemberInput,
  JoinHomeByCodeInput,
  UpdateMemberRoleInput,
  UpdateMemberInput,
  MemberRole,
} from '@homeexpense/shared';

@ApiTags('Homes & Memberships')
@Controller('homes')
export class HomesController {
  constructor(private readonly homesService: HomesService) {}

  // =========================================================================
  // HOME LIFECYCLE
  // =========================================================================

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new Home with caller designated as HOME_OWNER' })
  async createHome(@CurrentUser() user: any, @Body() body: CreateHomeInput) {
    const parseResult = CreateHomeSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.errors.map((e) => e.message).join(', '));
    }
    return this.homesService.createHome(user.id, parseResult.data);
  }

  @Post('join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Join a household using its unique secret code' })
  async joinHomeByCode(@CurrentUser() user: any, @Body() body: JoinHomeByCodeInput) {
    const parseResult = JoinHomeByCodeSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.errors.map((e) => e.message).join(', '));
    }
    return this.homesService.joinHomeByCode(user.id, parseResult.data.code);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all homes where caller is an active member' })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  async getUserHomes(
    @CurrentUser() user: any,
    @Query('includeArchived') includeArchived?: string
  ) {
    return this.homesService.getUserHomes(user.id, includeArchived === 'true');
  }

  // =========================================================================
  // PUBLIC / DIRECT INVITATION RESOLUTION (Placed before :homeId routes)
  // =========================================================================

  @Get('invitations/:token')
  @ApiOperation({ summary: 'Get invitation details by token without exposing sensitive data' })
  async getInvitationByToken(@Param('token') token: string) {
    return this.homesService.getInvitationByToken(token);
  }

  @Post('invitations/:token/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept invitation to join home as an authenticated user' })
  async acceptInvitation(@Param('token') token: string, @CurrentUser() user: any) {
    return this.homesService.acceptInvitation(token, user.id);
  }

  @Post('invitations/:token/reject')
  @ApiOperation({ summary: 'Reject an invitation' })
  async rejectInvitation(@Param('token') token: string) {
    return this.homesService.rejectInvitation(token);
  }

  // =========================================================================
  // HOME SCOPED OPERATIONS
  // =========================================================================

  @Get(':homeId')
  @UseGuards(JwtAuthGuard, HomeMemberGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get details of a specific home (Requires active membership)' })
  async getHomeDetails(@Param('homeId') homeId: string) {
    return this.homesService.getHomeDetails(homeId);
  }

  @Patch(':homeId')
  @UseGuards(JwtAuthGuard, HomeMemberGuard)
  @RequireRoles(MemberRole.OWNER, MemberRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update home settings/description/type/currency (Requires HOME_OWNER or HOME_ADMIN)' })
  async updateHome(
    @Param('homeId') homeId: string,
    @CurrentUser() user: any,
    @Body() body: UpdateHomeInput
  ) {
    const parseResult = UpdateHomeSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.errors.map((e) => e.message).join(', '));
    }
    return this.homesService.updateHome(homeId, user.id, parseResult.data);
  }

  @Post(':homeId/archive')
  @UseGuards(JwtAuthGuard, HomeMemberGuard)
  @RequireRoles(MemberRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive a home (Requires HOME_OWNER strictly)' })
  async archiveHome(@Param('homeId') homeId: string, @CurrentUser() user: any) {
    return this.homesService.archiveHome(homeId, user.id);
  }

  @Post(':homeId/restore')
  @UseGuards(JwtAuthGuard, HomeMemberGuard)
  @RequireRoles(MemberRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Restore an archived home (Requires HOME_OWNER strictly)' })
  async restoreHome(@Param('homeId') homeId: string, @CurrentUser() user: any) {
    return this.homesService.restoreHome(homeId, user.id);
  }

  @Delete(':homeId')
  @UseGuards(JwtAuthGuard, HomeMemberGuard)
  @RequireRoles(MemberRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Permanently delete home (Requires HOME_OWNER strictly)' })
  async deleteHome(@Param('homeId') homeId: string, @CurrentUser() user: any) {
    return this.homesService.deleteHome(homeId, user.id);
  }

  @Post(':homeId/transfer-ownership')
  @UseGuards(JwtAuthGuard, HomeMemberGuard)
  @RequireRoles(MemberRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Transfer home ownership to another active member (Requires HOME_OWNER strictly)' })
  async transferOwnership(
    @Param('homeId') homeId: string,
    @CurrentUser() user: any,
    @Body() body: { newOwnerMemberId: string }
  ) {
    if (!body?.newOwnerMemberId) {
      throw new BadRequestException('newOwnerMemberId is required.');
    }
    return this.homesService.transferOwnership(homeId, user.id, body.newOwnerMemberId);
  }

  @Post(':homeId/regenerate-code')
  @UseGuards(JwtAuthGuard, HomeMemberGuard)
  @RequireRoles(MemberRole.OWNER, MemberRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Regenerate the secret invite code for this household (Requires HOME_OWNER or HOME_ADMIN)' })
  async regenerateInviteCode(@Param('homeId') homeId: string, @CurrentUser() user: any) {
    return this.homesService.regenerateInviteCode(homeId, user.id);
  }

  // =========================================================================
  // INVITATIONS MANAGEMENT (HOME SCOPED)
  // =========================================================================

  @Post(':homeId/invitations')
  @UseGuards(JwtAuthGuard, HomeMemberGuard)
  @RequireRoles(MemberRole.OWNER, MemberRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a secure invitation with unpredictable cryptographic token' })
  async inviteMember(
    @Param('homeId') homeId: string,
    @CurrentUser() user: any,
    @Body() body: InviteMemberInput
  ) {
    const parseResult = InviteMemberSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.errors.map((e) => e.message).join(', '));
    }
    return this.homesService.inviteMember(homeId, user.id, parseResult.data);
  }

  @Get(':homeId/invitations')
  @UseGuards(JwtAuthGuard, HomeMemberGuard)
  @RequireRoles(MemberRole.OWNER, MemberRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all invitations for this home (Requires HOME_OWNER or HOME_ADMIN)' })
  async getInvitations(@Param('homeId') homeId: string, @CurrentUser() user: any) {
    return this.homesService.getInvitations(homeId, user.id);
  }

  @Delete(':homeId/invitations/:invitationId')
  @UseGuards(JwtAuthGuard, HomeMemberGuard)
  @RequireRoles(MemberRole.OWNER, MemberRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke an invitation (Requires HOME_OWNER or HOME_ADMIN)' })
  async revokeInvitation(
    @Param('homeId') homeId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: any
  ) {
    return this.homesService.revokeInvitation(homeId, user.id, invitationId);
  }

  // =========================================================================
  // MEMBERS MANAGEMENT (HOME SCOPED)
  // =========================================================================

  @Get(':homeId/members')
  @UseGuards(JwtAuthGuard, HomeMemberGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all members in the home' })
  async listMembers(@Param('homeId') homeId: string, @CurrentUser() user: any) {
    return this.homesService.listMembers(homeId, user.id);
  }

  @Patch(':homeId/members/:memberId')
  @UseGuards(JwtAuthGuard, HomeMemberGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update member profile (nickname, spending limit, or role)' })
  async updateMember(
    @Param('homeId') homeId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: any,
    @Body() body: UpdateMemberInput
  ) {
    const parseResult = UpdateMemberSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.errors.map((e) => e.message).join(', '));
    }
    return this.homesService.updateMember(homeId, user.id, memberId, parseResult.data);
  }

  @Patch(':homeId/members/:memberId/role')
  @UseGuards(JwtAuthGuard, HomeMemberGuard)
  @RequireRoles(MemberRole.OWNER, MemberRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update member role (Requires HOME_OWNER or HOME_ADMIN)' })
  async updateMemberRole(
    @Param('homeId') homeId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: any,
    @Body() body: UpdateMemberRoleInput
  ) {
    const parseResult = UpdateMemberRoleSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.errors.map((e) => e.message).join(', '));
    }
    return this.homesService.updateMemberRole(homeId, user.id, memberId, parseResult.data.role);
  }

  @Delete(':homeId/members/:memberId')
  @UseGuards(JwtAuthGuard, HomeMemberGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove or deactivate a member (Requires HOME_OWNER, HOME_ADMIN, or self-removal)' })
  async removeMember(
    @Param('homeId') homeId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: any
  ) {
    return this.homesService.removeMember(homeId, user.id, memberId);
  }
}
