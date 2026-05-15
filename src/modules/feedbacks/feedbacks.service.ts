import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AiService } from '../../shared/ai/ai.service';
import { InterviewsService } from '../interviews/interviews.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FeedbacksService {
  private readonly logger = new Logger(FeedbacksService.name);
  private readonly minUserAnswerTurns = 2;
  private readonly minUserAnswerChars = 50;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly interviewsService: InterviewsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async startGeneration(userId: string, createFeedbackDto: CreateFeedbackDto) {
    const { attemptId, transcript } = createFeedbackDto;
    const normalizedTranscript = this.normalizeTranscript(transcript);
    const attempt = await this.interviewsService.findAttemptById(attemptId);
    const { interview } = attempt;

    await this.interviewsService.saveTranscripts(attemptId, normalizedTranscript);

    const validation = this.validateMeaningfulTranscript(normalizedTranscript);
    if (!this.shouldBypassFeedbackTranscriptValidation() && !validation.valid) {
      const reason =
        validation.reason || 'Interview is too short to generate feedback.';
      await this.updateAttemptStatus(attemptId, {
        status: 'TOO_SHORT',
        endedAt: new Date(),
        failureReason: reason,
      });
      await this.createFailedNotification(
        userId,
        attemptId,
        interview,
        reason,
      );

      return {
        attemptId,
        status: 'TOO_SHORT',
        message: reason,
      };
    }

    await this.updateAttemptStatus(attemptId, {
      status: 'FEEDBACK_PROCESSING',
      endedAt: new Date(),
      failureReason: null,
    });
    this.emitProcessingNotification(userId, attemptId, interview);

    void this.processFeedbackGeneration(
      userId,
      attemptId,
      normalizedTranscript,
      interview,
    );

    return {
      attemptId,
      status: 'FEEDBACK_PROCESSING',
    };
  }

  async create(userId: string, createFeedbackDto: CreateFeedbackDto) {
    const { attemptId, transcript } = createFeedbackDto;
    const normalizedTranscript = this.normalizeTranscript(transcript);

    // Validate interview attempt exists
    const attempt = await this.interviewsService.findAttemptById(attemptId);
    const { interview } = attempt;
    const interviewId = interview.id;

    // Save a cleaned transcript so feedback and history are not polluted by
    // short STT fragments such as "and", "step", or greeting-only turns.
    await this.interviewsService.saveTranscripts(attemptId, normalizedTranscript);

    const validation = this.validateMeaningfulTranscript(normalizedTranscript);
    if (!this.shouldBypassFeedbackTranscriptValidation() && !validation.valid) {
      const reason =
        validation.reason || 'Interview is too short to generate feedback.';
      await this.updateAttemptStatus(attemptId, {
        status: 'TOO_SHORT',
        endedAt: new Date(),
        failureReason: reason,
      });

      throw new BadRequestException(reason);
    }

    return this.generateAndPersistFeedback(
      userId,
      attemptId,
      normalizedTranscript,
      interview,
    );
  }

  private async processFeedbackGeneration(
    userId: string,
    attemptId: string,
    normalizedTranscript: CreateFeedbackDto['transcript'],
    interview: any,
  ) {
    try {
      const feedback = await this.generateAndPersistFeedback(
        userId,
        attemptId,
        normalizedTranscript,
        interview,
      );
      await this.createCompletedNotification(
        userId,
        attemptId,
        interview,
        feedback?.id,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to generate interview feedback.';

      this.logger.error(`Feedback generation failed for attempt: ${attemptId}`, error);
      await this.createFailedNotification(userId, attemptId, interview, message);
    }
  }

  private async generateAndPersistFeedback(
    userId: string,
    attemptId: string,
    normalizedTranscript: CreateFeedbackDto['transcript'],
    interview: any,
  ) {
    const interviewId = interview.id;

    // Check if feedback already exists for this attempt
    const existing = await this.prisma.feedback.findUnique({
      where: { attemptId },
    });

    // Generate feedback using AI
    this.logger.log(`Generating AI feedback for attempt: ${attemptId}`);
    let aiResult: Awaited<ReturnType<AiService['generateFeedback']>>;

    try {
      aiResult = await this.aiService.generateFeedback(
        normalizedTranscript,
        interview.language,
        {
          role: interview.role,
          level: interview.level,
          type: interview.type,
          techstack: interview.techstack,
          language: interview.language,
        },
      );
    } catch (error) {
      await this.updateAttemptStatus(attemptId, {
        status: 'FAILED',
        endedAt: new Date(),
        failureReason:
          error instanceof Error
            ? error.message
            : 'Failed to generate interview feedback.',
      });
      throw error;
    }

    const feedbackData = {
      attemptId,
      interviewId,
      userId,
      totalScore: aiResult.totalScore,
      strengths: aiResult.strengths,
      areasForImprovement: aiResult.areasForImprovement,
      finalAssessment: aiResult.finalAssessment,
    };

    let feedback;

    if (existing) {
      // Update existing feedback (retake)
      feedback = await this.prisma.feedback.update({
        where: { id: existing.id },
        data: feedbackData,
      });

      // Delete old category scores and create new ones
      await this.prisma.categoryScore.deleteMany({
        where: { feedbackId: feedback.id },
      });
    } else {
      // Create new feedback
      feedback = await this.prisma.feedback.create({
        data: feedbackData,
      });
    }

    // Create category scores
    if (aiResult.categoryScores?.length > 0) {
      await this.prisma.categoryScore.createMany({
        data: aiResult.categoryScores.map((cs) => ({
          feedbackId: feedback.id,
          name: cs.name,
          score: cs.score,
          comment: cs.comment,
        })),
      });
    }

    const finishedAt = new Date();
    await this.updateAttemptStatus(attemptId, {
      status: 'COMPLETED',
      endedAt: finishedAt,
      completedAt: finishedAt,
      failureReason: null,
    });

    // Return feedback with category scores
    return this.prisma.feedback.findUnique({
      where: { id: feedback.id },
      include: { categoryScores: true },
    });
  }

  private emitProcessingNotification(
    userId: string,
    attemptId: string,
    interview: any,
  ) {
    this.notificationsService.emitRealtime(userId, {
      id: `feedback-generation-processing-${attemptId}`,
      type: 'FEEDBACK_GENERATION_PROCESSING',
      title: 'Generating feedback',
      message: `Your ${interview.role} interview feedback is being generated. You can keep using PrepWise while we review it.`,
      metadata: {
        attemptId,
        interviewId: interview.id,
        role: interview.role,
        level: interview.level,
        type: interview.type,
      },
    });
  }

  private async createCompletedNotification(
    userId: string,
    attemptId: string,
    interview: any,
    feedbackId?: string,
  ) {
    await this.notificationsService.create({
      userId,
      type: 'FEEDBACK_GENERATION_COMPLETED',
      title: 'Feedback ready',
      message: `Your ${interview.role} interview feedback is ready to review.`,
      actionUrl: `/interview/${interview.id}/feedback?attemptId=${attemptId}`,
      metadata: {
        attemptId,
        interviewId: interview.id,
        feedbackId,
        role: interview.role,
        level: interview.level,
        type: interview.type,
      },
    });
  }

  private async createFailedNotification(
    userId: string,
    attemptId: string,
    interview: any,
    message: string,
  ) {
    await this.notificationsService.create({
      userId,
      type: 'FEEDBACK_GENERATION_FAILED',
      title: 'Feedback was not generated',
      message,
      actionUrl: `/interview/${interview.id}`,
      metadata: {
        attemptId,
        interviewId: interview.id,
        role: interview.role,
        level: interview.level,
        type: interview.type,
      },
    });
  }

  async findByInterviewId(interviewId: string, userId: string) {
    return this.prisma.feedback.findFirst({
      where: {
        interviewId,
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: { categoryScores: true },
    });
  }

  async findByAttemptId(attemptId: string, userId: string) {
    return this.prisma.feedback.findFirst({
      where: {
        attemptId,
        userId,
      },
      include: { categoryScores: true },
    });
  }

  private validateMeaningfulTranscript(
    transcript: CreateFeedbackDto['transcript'],
  ) {
    const userAnswers = transcript
      .filter((item) => item.role.toLowerCase() === 'user')
      .map((item) => item.content.trim())
      .filter(Boolean);

    const totalUserAnswerChars = userAnswers.reduce(
      (total, answer) => total + answer.length,
      0,
    );

    if (
      userAnswers.length < this.minUserAnswerTurns ||
      totalUserAnswerChars < this.minUserAnswerChars
    ) {
      return {
        valid: false,
        reason:
          'Interview is too short to generate feedback. Please provide at least 2 answers and 50 total characters before ending.',
      };
    }

    return { valid: true };
  }

  private shouldBypassFeedbackTranscriptValidation() {
    return process.env.BYPASS_FEEDBACK_TRANSCRIPT_VALIDATION === 'true';
  }

  private normalizeTranscript(
    transcript: CreateFeedbackDto['transcript'],
  ): CreateFeedbackDto['transcript'] {
    const normalized = transcript
      .map((item) => ({
        role: item.role.trim().toLowerCase(),
        content: this.cleanTranscriptContent(item.content),
      }))
      .filter((item) => this.isSupportedTranscriptRole(item.role))
      .filter((item) => item.content.length > 0)
      .filter((item) => !this.isLowSignalTranscriptMessage(item));

    const merged: CreateFeedbackDto['transcript'] = [];

    for (const item of normalized) {
      const previous = merged[merged.length - 1];

      if (previous?.role === item.role) {
        previous.content = this.mergeTranscriptContent(
          previous.content,
          item.content,
        );
        continue;
      }

      merged.push({ ...item });
    }

    return merged.filter((item) => !this.isLowSignalTranscriptMessage(item));
  }

  private cleanTranscriptContent(content: string) {
    return content
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.!?])/g, '$1')
      .trim();
  }

  private mergeTranscriptContent(current: string, next: string) {
    if (!current) return next;
    if (!next) return current;

    const separator = /[.!?]$/.test(current) ? ' ' : ' ';
    return `${current}${separator}${next}`;
  }

  private isSupportedTranscriptRole(role: string) {
    return role === 'assistant' || role === 'user';
  }

  private isLowSignalTranscriptMessage(item: { role: string; content: string }) {
    const text = item.content
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!text) return true;

    if (item.role === 'assistant') {
      return this.isLowSignalAssistantMessage(text, item.content);
    }

    return this.isLowSignalUserMessage(text);
  }

  private isLowSignalAssistantMessage(text: string, original: string) {
    const lowSignalAssistantPhrases = new Set([
      'hello',
      'great',
      'alright',
      'ok',
      'okay',
      'have a great day',
      'let me simplify',
      'alright let me simplify',
      'thank you for taking the time to speak with me today',
      'im excited to learn more about you and your experience',
      'if you have any questions later feel free to reach out',
    ]);

    if (lowSignalAssistantPhrases.has(text)) return true;

    const wordCount = text.split(' ').length;
    return wordCount <= 3 && !original.includes('?');
  }

  private isLowSignalUserMessage(text: string) {
    const lowSignalUserPhrases = new Set([
      'and',
      'step',
      'view info',
      'information',
      'thanks',
      'thank you',
      'ok',
      'okay',
      'hello',
      'hi',
    ]);

    return lowSignalUserPhrases.has(text);
  }

  private async updateAttemptStatus(
    attemptId: string,
    data: Record<string, unknown>,
  ) {
    await (this.prisma.interviewAttempt.update as any)({
      where: { id: attemptId },
      data,
    });
  }
}
