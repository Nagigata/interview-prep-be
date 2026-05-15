import { Module } from '@nestjs/common';
import { InterviewsService } from './interviews.service';
import { InterviewsController } from './interviews.controller';
import { VapiWebhookController } from './vapi-webhook.controller';
import { AiModule } from '../../shared/ai/ai.module';
import { InterviewGenerationJobsService } from './interview-generation-jobs.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AiModule, AuthModule, NotificationsModule],
  controllers: [InterviewsController, VapiWebhookController],
  providers: [InterviewsService, InterviewGenerationJobsService],
  exports: [InterviewsService, InterviewGenerationJobsService],
})
export class InterviewsModule {}
