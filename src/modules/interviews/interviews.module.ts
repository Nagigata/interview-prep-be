import { Module } from '@nestjs/common';
import { InterviewsService } from './interviews.service';
import { InterviewsController } from './interviews.controller';
import { VapiWebhookController } from './vapi-webhook.controller';
import { AiModule } from '../../shared/ai/ai.module';
import { InterviewGenerationJobsService } from './interview-generation-jobs.service';
import { InterviewGenerationGateway } from './interview-generation.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AiModule, AuthModule],
  controllers: [InterviewsController, VapiWebhookController],
  providers: [
    InterviewsService,
    InterviewGenerationJobsService,
    InterviewGenerationGateway,
  ],
  exports: [InterviewsService, InterviewGenerationJobsService],
})
export class InterviewsModule {}
