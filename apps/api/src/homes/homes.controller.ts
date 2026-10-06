import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HomesService } from './homes.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { HomeMemberGuard } from './guards/home-member.guard.js';
import { RequireRoles } from './decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import {
  CreateHomeSchema,
  InviteMemberSchema,
  UpdateMemberRoleSchema,
  CreateHomeInput,
  InviteMemberInput,
  UpdateMemberRoleInput,
  MemberRole,
} from '@homeexpense/shared';

@ApiTags('Homes & Memberships')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('homes')
export class HomesController {
  constructor(private readonly homesService: HomesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new Home with caller designated as HOME_OWNER' })
  async createHome(@CurrentUser() user: any, @Body() body: CreateHomeInput) {
    const parseResult = CreateHomeSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.errors.map((e) => e.message).join(', '));
    }
    return this.homesService.createHome(user.id, parseResult.data);
  }

  @Get()
  @ApiOperation({ summary: 'List all homes where caller is an active member' })
  async getUserHomes(@CurrentUser() user: any) {
    return this.homesService.getUserHomes(user.id);
  }

  @Get(':homeId')
  @UseGuards(HomeMemberGuard)
  @ApiOperation({ summary: 'Get details of a specific home (Requires active membership)' })
  async getHomeDetails(@Param('homeId') homeId: string) {
    return this.homesService.getHomeDetails(homeId);
  }

  @Patch(':homeId')
  @UseGuards(HomeMemberGuard)
  @RequireRoles(MemberRole.OWNER, MemberRole.ADMIN)
  @ApiOperation({ summary: 'Update home settings/description (Requires HOME_OWNER or HOME_ADMIN)' })
  async updateHome(
    @Param('homeId') homeId: string,
    @CurrentUser() user: any,
    @Body() body: { name?: string; description?: string }
  ) {
    return this.homesService.updateHome(homeId, user.id, body);
  }

  @Delete(':homeId')
  @UseGuards(HomeMemberGuard)
  @RequireRoles(MemberRole.OWNER)
  @ApiOperation({ summary: 'Permanently delete home (Requires HOME_OWNER strictly)' })
  async deleteHome(@Param('homeId') homeId: string, @CurrentUser() user: any) {
    return this.homesService.deleteHome(homeId, user.id);
  }

  @Post(':homeId/members')
  @UseGuards(HomeMemberGuard)
  @RequireRoles(MemberRole.OWNER, MemberRole.ADMIN)
  @ApiOperation({ summary: 'Invite a member to the home (Requires HOME_OWNER or HOME_ADMIN)' })
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

  @Patch(':homeId/members/:memberId/role')
  @UseGuards(HomeMemberGuard)
  @RequireRoles(MemberRole.OWNER, MemberRole.ADMIN)
  @ApiOperation({ summary: 'Update role of a member (Enforces server-side hierarchy checks)' })
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
  @UseGuards(HomeMemberGuard)
  @ApiOperation({ summary: 'Remove a member from home (Requires HOME_OWNER, HOME_ADMIN, or self-removal)' })
  async removeMember(
    @Param('homeId') homeId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: any
  ) {
    return this.homesService.removeMember(homeId, user.id, memberId);
  }

  @Post(':homeId/transfer-ownership')
  @UseGuards(HomeMemberGuard)
  @RequireRoles(MemberRole.OWNER)
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
}
