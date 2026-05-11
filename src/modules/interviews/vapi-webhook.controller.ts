import {
  Controller,
  Post,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { InterviewsService } from './interviews.service';
import { AiService } from '../../shared/ai/ai.service';
import { InterviewGenerationJobsService } from './interview-generation-jobs.service';

@Controller('webhooks/vapi')
export class VapiWebhookController {
  private readonly logger = new Logger(VapiWebhookController.name);

  constructor(
    private readonly interviewsService: InterviewsService,
    private readonly aiService: AiService,
    private readonly generationJobsService: InterviewGenerationJobsService,
  ) {}

  @Public()
  @Post('start-generation')
  @HttpCode(HttpStatus.OK)
  async handleStartGeneration(@Body() body: any, @Res() res: Response) {
    if (body?.message?.type !== 'tool-calls') {
      return res.status(HttpStatus.OK).json({});
    }

    try {
      const rawArgs = body?.message?.toolCallList?.[0]?.function?.arguments;
      const args =
        typeof rawArgs === 'string' ? JSON.parse(rawArgs) : (rawArgs ?? body);
      const callVars = body?.message?.call?.variableValues || {};
      const userid = args.userid || callVars.userid;
      const language = args.language || callVars.language || 'en';
      const toolCallId = body?.message?.toolCallList?.[0]?.id ?? 'unknown';

      if (!userid) {
        throw new Error('Missing userid for interview generation job');
      }

      const job = await this.generationJobsService.startJob(userid, {
        role: args.role,
        level: args.level,
        type: args.type,
        techstack: args.techstack,
        amount: args.amount,
        language,
        provider: args.aiProvider || args.provider || callVars.aiProvider,
      });

      return res.status(HttpStatus.OK).json({
        results: [
          {
            toolCallId,
            result: `Interview generation has started. Job ID: ${job.id}. The app will notify the user when it is ready.`,
          },
        ],
      });
    } catch (error) {
      this.logger.error('Error starting interview generation job:', error);
      const toolCallId = body?.message?.toolCallList?.[0]?.id ?? 'unknown';
      return res.status(HttpStatus.OK).json({
        results: [
          {
            toolCallId,
            result:
              'Failed to start interview generation. Please ask the user to try again.',
          },
        ],
      });
    }
  }

  @Public()
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async handleGenerate(@Body() body: any, @Res() res: Response) {
    if (body?.message?.type !== 'tool-calls') {
      return res.status(HttpStatus.OK).json({});
    }
    const rawArgs = body?.message?.toolCallList?.[0]?.function?.arguments;
    const args =
      typeof rawArgs === 'string' ? JSON.parse(rawArgs) : (rawArgs ?? body);

    const { type, role, level, techstack, amount } = args;
    const callVars = body?.message?.call?.variableValues || {};
    const userid = args.userid || callVars.userid;
    const language = args.language || callVars.language || 'en';
    const provider = args.aiProvider || args.provider || callVars.aiProvider;
    const toolCallId = body?.message?.toolCallList?.[0]?.id ?? 'unknown';

    this.logger.log(`Generating interview for user: ${userid}, role: ${role}`);

    try {
      // Generate questions using AI
      const questions = await this.aiService.generateInterviewQuestions({
        role,
        level,
        type,
        techstack,
        amount,
        language,
        provider,
      });



      // Save interview to database
      await this.interviewsService.create(userid, {
        role,
        level,
        type,
        techstack: techstack ? techstack.split(',') : [],
        questions,
        finalized: true,
        language,
      });

      return res.status(HttpStatus.OK).json({
        results: [
          {
            toolCallId,
            result: 'Interview generated successfully!',
          },
        ],
      });
    } catch (error) {
      this.logger.error('Error generating interview:', error);
      return res.status(HttpStatus.OK).json({
        results: [
          {
            toolCallId,
            result: 'Failed to generate interview. Please try again.',
          },
        ],
      });
    }
  }
}
