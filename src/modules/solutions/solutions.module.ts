import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SolutionsController } from './solutions.controller';
import { SolutionsService } from './solutions.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [SolutionsController],
  providers: [SolutionsService],
})
export class SolutionsModule {}
