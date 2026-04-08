import { Module } from '@nestjs/common';
import { InterviewsService } from './interviews.service';
import { InterviewsController } from './interviews.controller';
import { VapiWebhookController } from './vapi-webhook.controller';
import { AiModule } from '../../shared/ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [InterviewsController, VapiWebhookController],
  providers: [InterviewsService],
  exports: [InterviewsService],
})
export class InterviewsModule {}
