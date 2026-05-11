import { Module } from '@nestjs/common';
import { InterviewsService } from './interviews.service';
import { InterviewsController } from './interviews.controller';
import { VapiWebhookController } from './vapi-webhook.controller';
import { AiModule } from '../../shared/ai/ai.module';
import { InterviewGenerationJobsService } from './interview-generation-jobs.service';

@Module({
  imports: [AiModule],
  controllers: [InterviewsController, VapiWebhookController],
  providers: [InterviewsService, InterviewGenerationJobsService],
  exports: [InterviewsService, InterviewGenerationJobsService],
})
export class InterviewsModule {}
