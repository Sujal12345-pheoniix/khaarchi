import { Controller, Post, Get, Param, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettlementsService } from './settlements.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { HomeMemberGuard } from '../homes/guards/home-member.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { CreateSettlementSchema, CreateSettlementInput } from '@homeexpense/shared';

@ApiTags('Settlements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HomeMemberGuard)
@Controller('homes/:homeId/settlements')
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Post()
  @ApiOperation({ summary: 'Record a debt settlement between two members with ledger update' })
  async createSettlement(
    @Param('homeId') homeId: string,
    @CurrentUser() user: any,
    @Body() body: CreateSettlementInput
  ) {
    const parseResult = CreateSettlementSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.errors.map((e) => e.message).join(', '));
    }
    return this.settlementsService.createSettlement(homeId, user.id, parseResult.data);
  }

  @Get()
  @ApiOperation({ summary: 'List all settlements recorded in this home' })
  async getSettlements(@Param('homeId') homeId: string) {
    return this.settlementsService.getHomeSettlements(homeId);
  }
}
