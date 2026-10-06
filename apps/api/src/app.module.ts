import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HomesModule } from './homes/homes.module.js';
import { ExpensesModule } from './expenses/expenses.module.js';
import { BalancesModule } from './balances/balances.module.js';
import { SettlementsModule } from './settlements/settlements.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    HomesModule,
    ExpensesModule,
    BalancesModule,
    SettlementsModule,
  ],
})
export class AppModule {}
