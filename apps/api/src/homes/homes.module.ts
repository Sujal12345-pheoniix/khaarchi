import { Module } from '@nestjs/common';
import { HomesService } from './homes.service.js';
import { HomesController } from './homes.controller.js';
import { HomeMemberGuard } from './guards/home-member.guard.js';

@Module({
  controllers: [HomesController],
  providers: [HomesService, HomeMemberGuard],
  exports: [HomesService, HomeMemberGuard],
})
export class HomesModule {}
