import { Module } from '@nestjs/common';
import { SettlementsService } from './settlements.service.js';
import { SettlementsController } from './settlements.controller.js';
import { HomesModule } from '../homes/homes.module.js';

@Module({
  imports: [HomesModule],
  controllers: [SettlementsController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}
