import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam } from '@nestjs/swagger';
import { FinancialHealthService } from './financial-health.service.js';
import { HealthSnapshotService } from './snapshots/health-snapshot.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { HomeMemberGuard } from '../homes/guards/home-member.guard.js';
import { FinancialHealthResponseDto } from './dto/financial-health-response.dto.js';

@ApiTags('Financial Health')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HomeMemberGuard)
@Controller('homes/:homeId/financial-health')
export class FinancialHealthController {
  constructor(
    private readonly financialHealthService: FinancialHealthService,
    private readonly snapshotService: HealthSnapshotService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Evaluate current household financial health, dimensions, risks, and trends',
  })
  @ApiParam({ name: 'homeId', description: 'Unique UUID of the household' })
  @ApiResponse({
    status: 200,
    description: 'Deterministic household financial health evaluation',
    type: FinancialHealthResponseDto,
  })
  async getFinancialHealth(@Param('homeId') homeId: string): Promise<FinancialHealthResponseDto> {
    return this.financialHealthService.evaluateHomeHealth(homeId);
  }

  @Get('history')
  @ApiOperation({
    summary: 'Get historical financial health snapshot timeline',
  })
  @ApiParam({ name: 'homeId', description: 'Unique UUID of the household' })
  async getHealthHistory(@Param('homeId') homeId: string) {
    return this.snapshotService.getSnapshotHistory(homeId);
  }
}
