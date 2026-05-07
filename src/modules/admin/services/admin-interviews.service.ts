import { Injectable } from '@nestjs/common';
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
}
