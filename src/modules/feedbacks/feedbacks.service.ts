import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AiService } from '../../shared/ai/ai.service';
import { InterviewsService } from '../interviews/interviews.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbacksService {
  private readonly logger = new Logger(FeedbacksService.name);
  private readonly minUserAnswerTurns = 2;
  private readonly minUserAnswerChars = 50;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly interviewsService: InterviewsService,
  ) {}

  async create(userId: string, createFeedbackDto: CreateFeedbackDto) {
    const { attemptId, transcript } = createFeedbackDto;

    // Validate interview attempt exists
    const attempt = await this.interviewsService.findAttemptById(attemptId);
    const { interview } = attempt;
    const interviewId = interview.id;

    // Save transcripts
    await this.interviewsService.saveTranscripts(attemptId, transcript);

    const validation = this.validateMeaningfulTranscript(transcript);
    if (!validation.valid) {
      await this.updateAttemptStatus(attemptId, {
        status: 'TOO_SHORT',
        endedAt: new Date(),
        failureReason: validation.reason,
      });

      throw new BadRequestException(validation.reason);
    }

    // Check if feedback already exists for this attempt
    const existing = await this.prisma.feedback.findUnique({
      where: { attemptId },
    });

    // Generate feedback using AI
    this.logger.log(`Generating AI feedback for attempt: ${attemptId}`);
    let aiResult: Awaited<ReturnType<AiService['generateFeedback']>>;

    try {
      aiResult = await this.aiService.generateFeedback(
        transcript,
        interview.language,
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
