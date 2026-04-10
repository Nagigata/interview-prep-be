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

@Controller('webhooks/vapi')
export class VapiWebhookController {
  private readonly logger = new Logger(VapiWebhookController.name);

  constructor(
    private readonly interviewsService: InterviewsService,
    private readonly aiService: AiService,
  ) {}

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
