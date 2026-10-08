import { Module } from '@nestjs/common';
import { CashflowController } from './cashflow.controller.js';
import { CashflowService } from './cashflow.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { BalancesModule } from '../balances/balances.module.js';

@Module({
  imports: [PrismaModule, BalancesModule],
  controllers: [CashflowController],
  providers: [CashflowService],
  exports: [CashflowService],
})
export class CashflowModule {}
