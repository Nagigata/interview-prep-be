import { Module } from '@nestjs/common';
import { FeedbacksService } from './feedbacks.service';
import { FeedbacksController } from './feedbacks.controller';
import { AiModule } from '../../shared/ai/ai.module';
import { InterviewsModule } from '../interviews/interviews.module';

@Module({
  imports: [AiModule, InterviewsModule],
  controllers: [FeedbacksController],
  providers: [FeedbacksService],
  exports: [FeedbacksService],
})
export class FeedbacksModule {}
