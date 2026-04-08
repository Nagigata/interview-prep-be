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
      include: {
        transcripts: {
          orderBy: { sequence: 'asc' },
        },
      },
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

  async saveTranscripts(
    interviewId: string,
    transcripts: { role: string; content: string }[],
  ) {
    // Validate interview exists
    await this.findById(interviewId);

    // Delete existing transcripts for this interview (in case of retake)
    await this.prisma.transcript.deleteMany({
      where: { interviewId },
    });

    // Create new transcripts
    const data = transcripts.map((t, index) => ({
      interviewId,
      role: t.role,
      content: t.content,
      sequence: index + 1,
    }));

    await this.prisma.transcript.createMany({ data });

    return { count: data.length };
  }
}
