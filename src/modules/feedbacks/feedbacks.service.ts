import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AiService } from '../../shared/ai/ai.service';
import { InterviewsService } from '../interviews/interviews.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbacksService {
  private readonly logger = new Logger(FeedbacksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly interviewsService: InterviewsService,
  ) {}

  async create(userId: string, createFeedbackDto: CreateFeedbackDto) {
    const { interviewId, transcript } = createFeedbackDto;

    // Validate interview exists
    await this.interviewsService.findById(interviewId);

    // Check if feedback already exists for this interview
    const existing = await this.prisma.feedback.findUnique({
      where: { interviewId },
    });

    // Save transcripts
    await this.interviewsService.saveTranscripts(interviewId, transcript);

    // Generate feedback using AI
    this.logger.log(`Generating AI feedback for interview: ${interviewId}`);
    const aiResult = await this.aiService.generateFeedback(transcript);

    const feedbackData = {
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
      include: { categoryScores: true },
    });
  }
}
