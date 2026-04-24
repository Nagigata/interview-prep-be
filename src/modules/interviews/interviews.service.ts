import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateInterviewDto } from './dto/create-interview.dto';

@Injectable()
export class InterviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createInterviewDto: CreateInterviewDto) {
    return this.prisma.interview.create({
      data: {
        ...createInterviewDto,
        userId,
      },
    });
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
    return this.prisma.interview.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findLatest(userId: string, limit = 20) {
    return this.prisma.interview.findMany({
      where: {
        finalized: true,
        userId: { not: userId },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
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

    await this.prisma.interviewAttempt.update({
      where: { id: attemptId },
      data: {
        completedAt: new Date(),
      },
    });

    return { count: data.length };
  }
}
