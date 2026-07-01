import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { RedisService } from '../../shared/redis/redis.service';
import { CreateInterviewDto } from './dto/create-interview.dto';

@Injectable()
export class InterviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(userId: string, createInterviewDto: CreateInterviewDto) {
    const interview = await this.prisma.interview.create({
      data: {
        ...createInterviewDto,
        userId,
      },
    });

    // Invalidate cached interview lists
    await this.redis.delByPattern('interviews:latest:*');
    await this.redis.del(`interviews:user:${userId}`);
    return interview;
  }

  async findById(id: string) {
    const interview = await this.prisma.interview.findUnique({
      where: { id },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    return interview;
  }

  async findByUserId(userId: string) {
    const cacheKey = `interviews:user:${userId}`;
    return this.redis.getOrSet(cacheKey, 60, async () => {
      const interviews = await (this.prisma.interview.findMany as any)({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: this.getStarInclude(userId),
      });

      return interviews.map((interview: any) => this.withStarred(interview));
    });
  }

  async findLatest(userId: string, limit = 20) {
    const cacheKey = `interviews:latest:${userId}:${limit}`;
    return this.redis.getOrSet(cacheKey, 60, async () => {
      const interviews = await (this.prisma.interview.findMany as any)({
        where: {
          finalized: true,
          archivedAt: null,
          userId: { not: userId },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: this.getStarInclude(userId),
      });

      return interviews.map((interview: any) => this.withStarred(interview));
    });
  }

  async update(id: string, data: Partial<CreateInterviewDto>) {
    const interview = await this.prisma.interview.findUnique({
      where: { id },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    return this.prisma.interview.update({
      where: { id },
      data,
    });
  }

  async createAttempt(interviewId: string, userId: string) {
    await this.findById(interviewId);

    return this.prisma.interviewAttempt.create({
      data: {
        interviewId,
        userId,
      },
    });
  }

  async findAttemptsByInterviewId(interviewId: string, userId: string) {
    await this.findById(interviewId);

    const attempts = await this.prisma.interviewAttempt.findMany({
      where: {
        interviewId,
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        feedback: {
          include: {
            categoryScores: true,
          },
        },
        _count: {
          select: {
            transcripts: true,
          },
        },
      },
    });

    return attempts.map(({ _count, ...attempt }) => ({
      ...attempt,
      transcriptCount: _count.transcripts,
    }));
  }

  async findAttemptById(id: string) {
    const attempt = await this.prisma.interviewAttempt.findUnique({
      where: { id },
      include: {
        interview: true,
        transcripts: {
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException('Interview attempt not found');
    }

    return attempt;
  }

  async findAttemptByIdForUser(id: string, userId: string) {
    const attempt = await this.prisma.interviewAttempt.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        interview: true,
        transcripts: {
          orderBy: { sequence: 'asc' },
        },
        feedback: {
          include: {
            categoryScores: true,
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException('Interview attempt not found');
    }

    return attempt;
  }

  async saveTranscripts(
    attemptId: string,
    transcripts: { role: string; content: string }[],
  ) {
    // Validate attempt exists
    await this.findAttemptById(attemptId);

    // Replace transcripts for this attempt
    await this.prisma.transcript.deleteMany({
      where: { attemptId },
    });

    // Create new transcripts
    const data = transcripts.map((t, index) => ({
      attemptId,
      role: t.role,
      content: t.content,
      sequence: index + 1,
    }));

    await this.prisma.transcript.createMany({ data });

    return { count: data.length };
  }

  async findAttemptedByUserId(userId: string) {
    const attempts = await this.prisma.interviewAttempt.findMany({
      where: { userId },
      select: { interviewId: true },
      distinct: ['interviewId'],
    });

    const interviewIds = attempts.map((a) => a.interviewId);
    if (interviewIds.length === 0) return [];

    const interviews = await (this.prisma.interview.findMany as any)({
      where: {
        id: { in: interviewIds },
        archivedAt: null,
        userId: { not: userId },
      },
      orderBy: { createdAt: 'desc' },
      include: this.getStarInclude(userId),
    });

    return interviews.map((interview: any) => this.withStarred(interview));
  }

  async toggleInterviewStar(userId: string, interviewId: string) {
    await this.findById(interviewId);

    const interviewStar = (this.prisma as any).interviewStar;

    const existingStar = await interviewStar.findUnique({
      where: {
        userId_interviewId: {
          userId,
          interviewId,
        },
      },
    });

    if (existingStar) {
      await interviewStar.delete({
        where: { id: existingStar.id },
      });
      return { starred: false };
    }

    await interviewStar.create({
      data: {
        userId,
        interviewId,
      },
    });
    return { starred: true };
  }

  async deleteInterview(interviewId: string, userId: string) {
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        _count: { select: { attempts: true } },
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    if (interview.userId !== userId) {
      throw new ForbiddenException('You can only delete your own interviews');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Get all attempt IDs for this interview
      const attempts = await tx.interviewAttempt.findMany({
        where: { interviewId },
        select: { id: true },
      });
      const attemptIds = attempts.map((a) => a.id);

      if (attemptIds.length > 0) {
        // 2. Delete category scores (via feedbacks)
        await tx.categoryScore.deleteMany({
          where: { feedback: { attemptId: { in: attemptIds } } },
        });
        // 3. Delete feedbacks
        await tx.feedback.deleteMany({
          where: { interviewId },
        });
        // 4. Delete transcripts
        await tx.transcript.deleteMany({
          where: { attemptId: { in: attemptIds } },
        });
        // 5. Delete attempts
        await tx.interviewAttempt.deleteMany({
          where: { interviewId },
        });
      }

      // 6. Delete interview
      return tx.interview.delete({ where: { id: interviewId } });
    });
  }

  private getStarInclude(userId: string) {
    return {
      stars: {
        where: { userId },
        take: 1,
      },
    };
  }

  private withStarred(interview: any) {
    const { stars, ...rest } = interview;

    return {
      ...rest,
      isStarred: stars?.length > 0,
    };
  }
}
