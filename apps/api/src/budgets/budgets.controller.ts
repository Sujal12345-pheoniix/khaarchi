import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { BudgetsService } from './budgets.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { HomeMemberGuard } from '../homes/guards/home-member.guard.js';
import { RequireRoles } from '../homes/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { MemberRole } from '@homeexpense/shared';
import { SetBudgetDto } from './dto/set-budget.dto.js';

@ApiTags('Budgets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HomeMemberGuard)
@Controller('homes/:homeId/budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get live budget envelopes and real spent amounts for current month' })
  @ApiParam({ name: 'homeId', description: 'Unique UUID of the household' })
  async getCurrentBudget(@Param('homeId') homeId: string) {
    return this.budgetsService.getCurrentBudget(homeId);
  }

  @Get()
  @ApiOperation({ summary: 'Get budget envelopes for a specific month and year' })
  @ApiParam({ name: 'homeId', description: 'Unique UUID of the household' })
  @ApiQuery({ name: 'month', required: false, type: Number, description: 'Month 1-12' })
  @ApiQuery({ name: 'year', required: false, type: Number, description: 'Year e.g. 2026' })
  async getBudgetForPeriod(
    @Param('homeId') homeId: string,
    @Query('month') month?: number,
    @Query('year') year?: number
  ) {
    return this.budgetsService.getCurrentBudget(
      homeId,
      month ? Number(month) : undefined,
      year ? Number(year) : undefined
    );
  }

  @Post()
  @RequireRoles(MemberRole.OWNER)
  @ApiOperation({ summary: 'Configure or update monthly budget and envelopes (Owner only)' })
  @ApiParam({ name: 'homeId', description: 'Unique UUID of the household' })
  async setBudget(
    @Param('homeId') homeId: string,
    @CurrentUser() user: any,
    @Body() body: SetBudgetDto
  ) {
    return this.budgetsService.setBudget(homeId, user.id, body);
  }
}
