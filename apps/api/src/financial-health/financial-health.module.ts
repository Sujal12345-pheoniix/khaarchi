import { Module } from '@nestjs/common';
import { FinancialHealthController } from './financial-health.controller.js';
import { FinancialHealthService } from './financial-health.service.js';
import { HealthSnapshotService } from './snapshots/health-snapshot.service.js';
import { BalancesModule } from '../balances/balances.module.js';

@Module({
  imports: [BalancesModule],
  controllers: [FinancialHealthController],
  providers: [FinancialHealthService, HealthSnapshotService],
  exports: [FinancialHealthService, HealthSnapshotService],
})
export class FinancialHealthModule {}
