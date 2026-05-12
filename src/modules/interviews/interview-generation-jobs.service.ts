import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AiService } from '../../shared/ai/ai.service';
import { StartInterviewGenerationDto } from './dto/start-interview-generation.dto';
import { InterviewGenerationGateway } from './interview-generation.gateway';
import { InterviewGenerationJob } from '@prisma/client';

type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

@Injectable()
export class InterviewGenerationJobsService {
  private readonly logger = new Logger(InterviewGenerationJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly generationGateway: InterviewGenerationGateway,
  ) {}

  async startJob(userId: string, dto: StartInterviewGenerationDto) {
    const techstack = this.normalizeTechstack(dto.techstack);
    if (!techstack.length) {
      throw new BadRequestException('Tech stack must include at least one item');
    }

    const job = await this.jobs.create({
      data: {
        userId,
        role: dto.role,
        level: dto.level,
        type: dto.type,
        techstack,
        amount: dto.amount,
        language: dto.language || 'en',
        provider: dto.provider,
        status: 'PENDING' satisfies JobStatus,
      },
    });

    void this.processJob(job.id);
    this.emitJobUpdate(job);
    return this.toResponse(job);
  }

  async getLatestForUser(userId: string) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const job = await this.jobs.findFirst({
      where: {
        userId,
        createdAt: { gte: oneDayAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    return job ? this.toResponse(job) : null;
  }

  async getByIdForUser(jobId: string, userId: string) {
    const job = await this.jobs.findFirst({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new NotFoundException('Interview generation job not found');
    }

    return this.toResponse(job);
  }

  private async processJob(jobId: string) {
    const job = await this.jobs.findUnique({ where: { id: jobId } });
    if (!job) return;

    const processingJob = await this.jobs.update({
      where: { id: jobId },
      data: { status: 'PROCESSING' satisfies JobStatus },
    });
    this.emitJobUpdate(processingJob);

    try {
      const questions = await this.aiService.generateInterviewQuestions({
        role: job.role,
        level: job.level,
        type: job.type,
        techstack: job.techstack.join(', '),
        amount: job.amount,
        language: job.language,
        provider: job.provider,
      });

      const interview = await this.prisma.interview.create({
        data: {
          userId: job.userId,
          role: job.role,
          level: job.level,
          type: job.type,
          techstack: job.techstack,
          questions,
          language: job.language,
          finalized: true,
        },
      });

      const completedJob = await this.jobs.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED' satisfies JobStatus,
          interviewId: interview.id,
          completedAt: new Date(),
        },
      });
      this.emitJobUpdate(completedJob);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to generate interview';

      this.logger.error(`Generation job ${jobId} failed`, error);
      const failedJob = await this.jobs.update({
        where: { id: jobId },
        data: {
          status: 'FAILED' satisfies JobStatus,
          errorMessage: message,
          completedAt: new Date(),
        },
      });
      this.emitJobUpdate(failedJob);
    }
  }

  private normalizeTechstack(value: string) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private toResponse(job: InterviewGenerationJob) {
    return {
      id: job.id,
      status: job.status,
      role: job.role,
      level: job.level,
      type: job.type,
      techstack: job.techstack,
      amount: job.amount,
      language: job.language,
      provider: job.provider,
      interviewId: job.interviewId,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
    };
  }

  private emitJobUpdate(job: InterviewGenerationJob) {
    this.generationGateway.emitGenerationJobUpdated(
      job.userId,
      this.toResponse(job),
    );
  }

  private get jobs() {
    return (this.prisma as any).interviewGenerationJob;
  }
}
