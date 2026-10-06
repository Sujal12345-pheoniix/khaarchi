import { Module } from '@nestjs/common';
import { BalancesService } from './balances.service.js';
import { BalancesController } from './balances.controller.js';
import { HomesModule } from '../homes/homes.module.js';

@Module({
  imports: [HomesModule],
  controllers: [BalancesController],
  providers: [BalancesService],
  exports: [BalancesService],
})
export class BalancesModule {}
