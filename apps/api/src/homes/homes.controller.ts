import {
  Controller,
  Post,
  Get,
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
  CreateHomeInput,
  InviteMemberInput,
  MemberRole,
} from '@homeexpense/shared';

@ApiTags('Homes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('homes')
export class HomesController {
  constructor(private readonly homesService: HomesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new Home with caller as OWNER' })
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
  @ApiOperation({ summary: 'Get details of a specific home' })
  async getHomeDetails(@Param('homeId') homeId: string) {
    return this.homesService.getHomeDetails(homeId);
  }

  @Post(':homeId/members')
  @UseGuards(HomeMemberGuard)
  @RequireRoles(MemberRole.OWNER, MemberRole.ADMIN)
  @ApiOperation({ summary: 'Invite or add a member to the home (Requires OWNER or ADMIN)' })
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
}
