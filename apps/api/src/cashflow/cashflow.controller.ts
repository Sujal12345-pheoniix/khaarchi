import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { CashflowService } from './cashflow.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { HomeMemberGuard } from '../homes/guards/home-member.guard.js';
import { RequireRoles } from '../homes/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { MemberRole } from '@homeexpense/shared';
import { SafeToSpendResponseDto } from './dto/safe-to-spend-response.dto.js';
import { SetReserveDto } from './dto/set-reserve.dto.js';

@ApiTags('Cashflow & Safe-to-Spend')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HomeMemberGuard)
@Controller('homes/:homeId/cashflow')
export class CashflowController {
  constructor(private readonly cashflowService: CashflowService) {}

  @Get('safe-to-spend')
  @ApiOperation({
    summary:
      'Calculate authoritative Household Safe-to-Spend, obligation burden, and cashflow breakdown',
  })
  @ApiParam({ name: 'homeId', description: 'Unique UUID of the household' })
  @ApiResponse({
    status: 200,
    description: 'Safe-to-Spend evaluation result',
    type: SafeToSpendResponseDto,
  })
  async getSafeToSpend(@Param('homeId') homeId: string) {
    return this.cashflowService.getSafeToSpend(homeId);
  }

  @Patch('reserve')
  @RequireRoles(MemberRole.OWNER)
  @ApiOperation({
    summary:
      'Configure or update protected emergency reserve for the household (Owner only)',
  })
  @ApiParam({ name: 'homeId', description: 'Unique UUID of the household' })
  async updateProtectedReserve(
    @Param('homeId') homeId: string,
    @CurrentUser() user: any,
    @Body() body: SetReserveDto
  ) {
    return this.cashflowService.updateProtectedReserve(
      homeId,
      user.id,
      body.protectedReserve
    );
  }
}
