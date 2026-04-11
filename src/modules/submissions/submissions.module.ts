import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Module({
  imports: [HttpModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, PrismaService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
