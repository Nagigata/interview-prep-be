import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  AdminAuditContext,
  AdminAuditLogService,
} from './admin-audit-log.service';

type AdminCommentsQuery = {
  page: number;
  limit: number;
  search?: string;
  hasReplies?: string;
  createdFrom?: string;
  createdTo?: string;
};

@Injectable()
export class AdminCommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AdminAuditLogService,
  ) {}

  private parseDate(value?: string) {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  async getComments(params: AdminCommentsQuery) {
    const { page, limit, search, hasReplies, createdFrom, createdTo } = params;
    const skip = (page - 1) * limit;
    const fromDate = this.parseDate(createdFrom);
    const toDate = this.parseDate(createdTo);
    const where: Prisma.SolutionCommentWhereInput = {
      deletedAt: null,
      solution: { deletedAt: null },
    };

    if (search) {
      where.OR = [
        { content: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { solution: { title: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (hasReplies === 'true') {
      where.replies = { some: { deletedAt: null } };
    }
    if (hasReplies === 'false') {
      where.replies = { none: { deletedAt: null } };
    }
    if (fromDate || toDate) {
      where.createdAt = {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.solutionComment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          content: true,
          isEdited: true,
          createdAt: true,
          solutionId: true,
          parentId: true,
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          solution: {
            select: {
              id: true,
              title: true,
              challengeId: true,
              challenge: {
                select: {
                  id: true,
                  title: true,
                  skill: { select: { slug: true, name: true } },
                },
              },
            },
          },
          _count: { select: { replies: true, upvotes: true } },
        },
      }),
      this.prisma.solutionComment.count({ where }),
    ]);

    return {
      items: items.map((comment) => ({
        id: comment.id,
        content: comment.content,
        isEdited: comment.isEdited,
        createdAt: comment.createdAt,
        solutionId: comment.solutionId,
        parentId: comment.parentId,
        author: comment.user,
        solution: comment.solution,
        replyCount: comment._count.replies,
        upvoteCount: comment._count.upvotes,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getCommentDetail(commentId: string) {
    const comment = await this.prisma.solutionComment.findFirst({
      where: { id: commentId, deletedAt: null, solution: { deletedAt: null } },
      select: {
        id: true,
        content: true,
        isEdited: true,
        createdAt: true,
        updatedAt: true,
        parentId: true,
        solutionId: true,
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        parent: {
          select: {
            id: true,
            content: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            content: true,
            createdAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        solution: {
          select: {
            id: true,
            title: true,
            challengeId: true,
            challenge: {
              select: {
                id: true,
                title: true,
                skill: { select: { name: true, slug: true } },
              },
            },
          },
        },
        _count: { select: { replies: true, upvotes: true } },
      },
    });

    if (!comment) {
      throw new BadRequestException('Comment not found.');
    }

    const { user, _count, ...rest } = comment;
    return {
      ...rest,
      author: user,
      replyCount: _count.replies,
      upvoteCount: _count.upvotes,
    };
  }

  async deleteComment(
    commentId: string,
    reason?: string,
    auditContext?: AdminAuditContext,
  ) {
    const before = await this.prisma.solutionComment.findFirst({
      where: { id: commentId, deletedAt: null },
      select: {
        id: true,
        content: true,
        isEdited: true,
        createdAt: true,
        parentId: true,
        user: { select: { id: true, name: true, email: true } },
        solution: {
          select: {
            id: true,
            title: true,
            challengeId: true,
            challenge: {
              select: {
                id: true,
                title: true,
                skill: { select: { name: true, slug: true } },
              },
            },
          },
        },
        _count: { select: { replies: true, upvotes: true } },
      },
    });

    if (!before) {
      throw new BadRequestException('Comment not found.');
    }

    const deleted = await this.prisma.solutionComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
      select: { id: true, deletedAt: true },
    });

    if (auditContext) {
      await this.auditLogService.record({
        ...auditContext,
        action: 'DELETE_SOLUTION_COMMENT',
        entityType: 'SOLUTION_COMMENT',
        entityId: before.id,
        entityName: before.content.slice(0, 80),
        metadata: {
          reason: reason?.trim() || null,
          before: {
            content: before.content,
            isEdited: before.isEdited,
            createdAt: before.createdAt,
            parentId: before.parentId,
            author: before.user,
            solution: before.solution,
            counts: {
              replies: before._count.replies,
              upvotes: before._count.upvotes,
            },
          },
          after: { deletedAt: deleted.deletedAt },
        },
      });
    }

    return deleted;
  }
}
