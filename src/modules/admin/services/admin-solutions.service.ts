import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  AdminAuditContext,
  AdminAuditLogService,
} from './admin-audit-log.service';

type AdminSolutionsQuery = {
  page: number;
  limit: number;
  search?: string;
  language?: string;
  challengeId?: string;
  createdFrom?: string;
  createdTo?: string;
};

@Injectable()
export class AdminSolutionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AdminAuditLogService,
  ) {}

  private parseDate(value?: string) {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  async getSolutions(params: AdminSolutionsQuery) {
    const {
      page,
      limit,
      search,
      language,
      challengeId,
      createdFrom,
      createdTo,
    } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.ChallengeSolutionWhereInput = { deletedAt: null };
    const fromDate = this.parseDate(createdFrom);
    const toDate = this.parseDate(createdTo);

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { challenge: { title: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (language) where.language = language;
    if (challengeId) where.challengeId = challengeId;
    if (fromDate || toDate) {
      where.createdAt = {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.challengeSolution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          language: true,
          createdAt: true,
          challengeId: true,
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          challenge: {
            select: {
              id: true,
              title: true,
              slug: true,
              skill: { select: { id: true, name: true, slug: true } },
            },
          },
          _count: { select: { upvotes: true, comments: true, views: true } },
        },
      }),
      this.prisma.challengeSolution.count({ where }),
    ]);

    return {
      items: items.map((solution) => ({
        id: solution.id,
        title: solution.title,
        language: solution.language,
        createdAt: solution.createdAt,
        challengeId: solution.challengeId,
        author: solution.user,
        challenge: solution.challenge,
        upvoteCount: solution._count.upvotes,
        commentCount: solution._count.comments,
        viewCount: solution._count.views,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getSolutionDetail(solutionId: string) {
    const solution = await this.prisma.challengeSolution.findFirst({
      where: { id: solutionId, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        language: true,
        code: true,
        createdAt: true,
        updatedAt: true,
        challengeId: true,
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        challenge: {
          select: {
            id: true,
            title: true,
            slug: true,
            difficulty: true,
            skill: { select: { id: true, name: true, slug: true } },
          },
        },
        submission: {
          select: {
            id: true,
            status: true,
            runtime: true,
            memory: true,
            createdAt: true,
          },
        },
        _count: { select: { upvotes: true, comments: true, views: true } },
      },
    });

    if (!solution) {
      throw new BadRequestException('Solution not found.');
    }

    const { user, _count, ...rest } = solution;
    return {
      ...rest,
      author: user,
      upvoteCount: _count.upvotes,
      commentCount: _count.comments,
      viewCount: _count.views,
    };
  }

  async deleteSolution(
    solutionId: string,
    reason?: string,
    auditContext?: AdminAuditContext,
  ) {
    const before = await this.prisma.challengeSolution.findFirst({
      where: { id: solutionId, deletedAt: null },
      select: {
        id: true,
        title: true,
        language: true,
        description: true,
        code: true,
        createdAt: true,
        challengeId: true,
        user: { select: { id: true, name: true, email: true } },
        challenge: {
          select: {
            id: true,
            title: true,
            skill: { select: { id: true, name: true, slug: true } },
          },
        },
        _count: { select: { upvotes: true, comments: true, views: true } },
      },
    });

    if (!before) {
      throw new BadRequestException('Solution not found.');
    }

    const deleted = await this.prisma.challengeSolution.update({
      where: { id: solutionId },
      data: { deletedAt: new Date() },
      select: { id: true, title: true, deletedAt: true },
    });

    if (auditContext) {
      await this.auditLogService.record({
        ...auditContext,
        action: 'DELETE_SOLUTION',
        entityType: 'SOLUTION',
        entityId: before.id,
        entityName: before.title,
        metadata: {
          reason: reason?.trim() || null,
          before: {
            title: before.title,
            language: before.language,
            description: before.description,
            codePreview: before.code.slice(0, 500),
            createdAt: before.createdAt,
            author: before.user,
            challenge: before.challenge,
            counts: {
              upvotes: before._count.upvotes,
              comments: before._count.comments,
              views: before._count.views,
            },
          },
          after: { deletedAt: deleted.deletedAt },
        },
      });
    }

    return deleted;
  }
}
