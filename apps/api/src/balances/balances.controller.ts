import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BalancesService } from './balances.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { HomeMemberGuard } from '../homes/guards/home-member.guard.js';

@ApiTags('Balances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HomeMemberGuard)
@Controller('homes/:homeId/balances')
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @Get()
  @ApiOperation({ summary: 'Get live balances, pairwise debts, and simplified settlement plan' })
  async getHomeBalances(@Param('homeId') homeId: string) {
    return this.balancesService.getHomeBalances(homeId);
  }
}
