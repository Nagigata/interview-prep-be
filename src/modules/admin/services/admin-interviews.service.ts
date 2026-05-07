import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';

@Injectable()
export class AdminInterviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async getInterviews(params: {
    page: number;
    limit: number;
    search?: string;
  }) {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { role: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.interview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          role: true,
          level: true,
          type: true,
          techstack: true,
          language: true,
          finalized: true,
          archivedAt: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
          _count: { select: { attempts: true, feedbacks: true } },
        },
      }),
      this.prisma.interview.count({ where }),
    ]);

    return {
      items: items.map((interview) => ({
        ...interview,
        totalAttempts: interview._count.attempts,
        totalFeedbacks: interview._count.feedbacks,
        _count: undefined,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getInterviewDetail(interviewId: string) {
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      select: {
        id: true,
        role: true,
        level: true,
        type: true,
        techstack: true,
        questions: true,
        language: true,
        finalized: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, name: true, email: true } },
        attempts: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            createdAt: true,
            completedAt: true,
            user: { select: { id: true, name: true, email: true } },
            feedback: {
              select: {
                id: true,
                totalScore: true,
                createdAt: true,
              },
            },
            _count: { select: { transcripts: true } },
          },
        },
        _count: { select: { attempts: true, feedbacks: true } },
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found.');
    }

    return {
      ...interview,
      totalAttempts: interview._count.attempts,
      totalFeedbacks: interview._count.feedbacks,
      attempts: interview.attempts.map((attempt) => ({
        ...attempt,
        transcriptCount: attempt._count.transcripts,
        hasFeedback: Boolean(attempt.feedback),
        _count: undefined,
      })),
      _count: undefined,
    };
  }

  async getAttemptDetail(interviewId: string, attemptId: string) {
    const attempt = await this.prisma.interviewAttempt.findFirst({
      where: {
        id: attemptId,
        interviewId,
      },
      select: {
        id: true,
        interviewId: true,
        userId: true,
        createdAt: true,
        completedAt: true,
        interview: {
          select: {
            id: true,
            role: true,
            level: true,
            type: true,
            techstack: true,
            language: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        user: { select: { id: true, name: true, email: true } },
        transcripts: {
          orderBy: { sequence: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            sequence: true,
            createdAt: true,
          },
        },
        feedback: {
          select: {
            id: true,
            totalScore: true,
            strengths: true,
            areasForImprovement: true,
            finalAssessment: true,
            createdAt: true,
            categoryScores: {
              select: {
                id: true,
                name: true,
                score: true,
                comment: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException('Interview attempt not found.');
    }

    return attempt;
  }

  async setInterviewArchived(interviewId: string, shouldArchive: boolean) {
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      select: { id: true },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found.');
    }

    return this.prisma.interview.update({
      where: { id: interviewId },
      data: {
        archivedAt: shouldArchive ? new Date() : null,
      },
      select: {
        id: true,
        role: true,
        archivedAt: true,
      },
    });
  }
}
