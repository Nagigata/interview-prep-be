import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateSolutionDto } from './dto/create-solution.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class SolutionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createSolution(
    userId: string,
    challengeId: string,
    dto: CreateSolutionDto,
  ) {
    const submission = await this.prisma.challengeSubmission.findFirst({
      where: { id: dto.submissionId, userId, challengeId, status: 'ACCEPTED' },
    });
    if (!submission) {
      throw new BadRequestException('Submission not found or not Accepted');
    }

    const existing = await this.prisma.challengeSolution.findUnique({
      where: { submissionId: dto.submissionId },
    });
    if (existing) {
      throw new BadRequestException('This submission has already been shared');
    }

    return this.prisma.challengeSolution.create({
      data: {
        challengeId,
        userId,
        submissionId: dto.submissionId,
        title: dto.title,
        description: dto.description,
        language: submission.language,
        code: submission.code,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { upvotes: true, comments: true } },
      },
    });
  }

  async getSolutions(
    challengeId: string,
    userId?: string,
    page = 1,
    limit = 20,
  ) {
    const skip = (page - 1) * limit;
    const where = { challengeId, deletedAt: null };

    const [solutions, total] = await Promise.all([
      this.prisma.challengeSolution.findMany({
        where,
        orderBy: [{ upvotes: { _count: 'desc' } }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { upvotes: true, comments: true, views: true } },
          upvotes: userId ? { where: { userId } } : false,
        },
      }),
      this.prisma.challengeSolution.count({ where }),
    ]);

    return {
      solutions: solutions.map((s) => ({
        ...s,
        upvoteCount: s._count.upvotes,
        commentCount: s._count.comments,
        viewCount: s._count.views,
        isUpvoted: userId ? (s.upvotes as any[]).length > 0 : false,
        upvotes: undefined,
        _count: undefined,
      })),
      total,
      page,
      limit,
    };
  }

  async getSolutionById(solutionId: string, userId?: string) {
    const solution = await this.prisma.challengeSolution.findFirst({
      where: { id: solutionId, deletedAt: null },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { upvotes: true, comments: true, views: true } },
        upvotes: userId ? { where: { userId } } : false,
        comments: {
          where: { parentId: null },
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
            _count: { select: { upvotes: true } },
            upvotes: userId ? { where: { userId } } : false,
            replies: {
              orderBy: { createdAt: 'asc' },
              include: {
                user: { select: { id: true, name: true, avatarUrl: true } },
                _count: { select: { upvotes: true } },
                upvotes: userId ? { where: { userId } } : false,
              },
            },
          },
        },
      },
    });

    if (!solution) throw new NotFoundException('Solution not found');

    if (userId && userId !== solution.userId) {
      await this.prisma.solutionView.upsert({
        where: { userId_solutionId: { userId, solutionId } },
        create: { userId, solutionId },
        update: {},
      });
    }

    const mapComment = (c: any) => ({
      ...c,
      upvoteCount: c._count.upvotes,
      isUpvoted: userId ? (c.upvotes as any[]).length > 0 : false,
      upvotes: undefined,
      _count: undefined,
      replies: c.replies?.map(mapComment) ?? [],
    });

    return {
      ...solution,
      upvoteCount: solution._count.upvotes,
      commentCount: solution._count.comments,
      viewCount: solution._count.views,
      isUpvoted: userId ? (solution.upvotes as any[]).length > 0 : false,
      upvotes: undefined,
      _count: undefined,
      comments: solution.comments.map(mapComment),
    };
  }

  async deleteSolution(userId: string, solutionId: string) {
    const solution = await this.prisma.challengeSolution.findUnique({
      where: { id: solutionId },
    });
    if (!solution) throw new NotFoundException('Solution not found');
    if (solution.userId !== userId) throw new ForbiddenException();

    await this.prisma.challengeSolution.delete({ where: { id: solutionId } });
  }

  async toggleSolutionUpvote(userId: string, solutionId: string) {
    const solution = await this.prisma.challengeSolution.findFirst({
      where: { id: solutionId, deletedAt: null },
    });
    if (!solution) throw new NotFoundException('Solution not found');

    const existing = await this.prisma.solutionUpvote.findUnique({
      where: { userId_solutionId: { userId, solutionId } },
    });

    if (existing) {
      await this.prisma.solutionUpvote.delete({
        where: { userId_solutionId: { userId, solutionId } },
      });
      return { isUpvoted: false };
    }

    await this.prisma.solutionUpvote.create({ data: { userId, solutionId } });
    return { isUpvoted: true };
  }

  async createComment(
    userId: string,
    solutionId: string,
    dto: CreateCommentDto,
  ) {
    const solution = await this.prisma.challengeSolution.findFirst({
      where: { id: solutionId, deletedAt: null },
      include: {
        user: { select: { id: true } },
        challenge: { select: { skill: { select: { slug: true } } } },
      },
    });
    if (!solution) throw new NotFoundException('Solution not found');

    const solutionUrl = `/preparation/${solution.challenge.skill.slug}/${solution.challengeId}?tab=solutions&solutionId=${solutionId}`;

    if (dto.parentId) {
      const parent = await this.prisma.solutionComment.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent || parent.solutionId !== solutionId) {
        throw new BadRequestException('Invalid parent comment');
      }
    }

    const comment = await this.prisma.solutionComment.create({
      data: {
        solutionId,
        userId,
        parentId: dto.parentId,
        content: dto.content,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { upvotes: true } },
      },
    });

    if (solution.user.id !== userId && !dto.parentId) {
      await this.notificationsService.create({
        userId: solution.user.id,
        type: 'CHALLENGE_NEW_COMMENT',
        title: 'New comment on your solution',
        message: `Someone commented on your solution`,
        actionUrl: solutionUrl,
      });
    }

    if (dto.parentId) {
      const parent = await this.prisma.solutionComment.findUnique({
        where: { id: dto.parentId },
        select: { userId: true },
      });
      if (parent && parent.userId !== userId) {
        await this.notificationsService.create({
          userId: parent.userId,
          type: 'CHALLENGE_COMMENT_REPLY',
          title: 'New reply to your comment',
          message: `Someone replied to your comment`,
          actionUrl: solutionUrl,
        });
      }
    }

    const mentionRegex = /\B@([a-zA-Z0-9_]+)/g;
    const mentions = [...dto.content.matchAll(mentionRegex)].map((m) => m[1]);
    if (mentions.length > 0) {
      const mentionedUsers = await this.prisma.user.findMany({
        where: { name: { in: mentions } },
        select: { id: true },
      });
      await Promise.all(
        mentionedUsers
          .filter((u) => u.id !== userId)
          .map((u) =>
            this.notificationsService.create({
              userId: u.id,
              type: 'CHALLENGE_COMMENT_MENTION',
              title: 'You were mentioned',
              message: `You were mentioned in a solution comment`,
              actionUrl: solutionUrl,
            }),
          ),
      );
    }

    return {
      ...comment,
      upvoteCount: comment._count.upvotes,
      isUpvoted: false,
      _count: undefined,
      replies: [],
    };
  }

  async updateComment(
    userId: string,
    commentId: string,
    dto: UpdateCommentDto,
  ) {
    const comment = await this.prisma.solutionComment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) throw new ForbiddenException();
    if (comment.deletedAt) throw new BadRequestException('Comment is deleted');

    return this.prisma.solutionComment.update({
      where: { id: commentId },
      data: { content: dto.content, isEdited: true },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
  }

  async deleteComment(userId: string, commentId: string) {
    const comment = await this.prisma.solutionComment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) throw new ForbiddenException();

    await this.prisma.solutionComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
  }

  async toggleCommentUpvote(userId: string, commentId: string) {
    const comment = await this.prisma.solutionComment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Comment not found');

    const existing = await this.prisma.solutionCommentUpvote.findUnique({
      where: { userId_commentId: { userId, commentId } },
    });

    if (existing) {
      await this.prisma.solutionCommentUpvote.delete({
        where: { userId_commentId: { userId, commentId } },
      });
      return { isUpvoted: false };
    }

    await this.prisma.solutionCommentUpvote.create({
      data: { userId, commentId },
    });
    return { isUpvoted: true };
  }

  async getMySolutions(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const where = { userId, deletedAt: null };
    const [solutions, total] = await Promise.all([
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
          _count: { select: { upvotes: true, views: true, comments: true } },
          challenge: {
            select: {
              title: true,
              skill: { select: { slug: true } },
            },
          },
        },
      }),
      this.prisma.challengeSolution.count({ where }),
    ]);

    return {
      items: solutions.map((s) => ({
        id: s.id,
        title: s.title,
        language: s.language,
        createdAt: s.createdAt,
        challengeId: s.challengeId,
        challengeTitle: s.challenge.title,
        skillSlug: s.challenge.skill.slug,
        upvoteCount: s._count.upvotes,
        viewCount: s._count.views,
        commentCount: s._count.comments,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getMySolutionComments(userId: string, page = 1, limit = 10) {
    const normalizedPage = Math.max(page, 1);
    const normalizedLimit = Math.min(Math.max(limit, 1), 50);
    const skip = (normalizedPage - 1) * normalizedLimit;
    const where = {
      userId,
      deletedAt: null,
      solution: { userId: { not: userId }, deletedAt: null },
    };

    const [comments, total] = await Promise.all([
      this.prisma.solutionComment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: normalizedLimit,
        select: {
          id: true,
          content: true,
          createdAt: true,
          solutionId: true,
          solution: {
            select: {
              title: true,
              challengeId: true,
              challenge: {
                select: { skill: { select: { slug: true } } },
              },
            },
          },
        },
      }),
      this.prisma.solutionComment.count({ where }),
    ]);

    return {
      items: comments.map((c) => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        solutionId: c.solutionId,
        solutionTitle: c.solution.title,
        challengeId: c.solution.challengeId,
        skillSlug: c.solution.challenge.skill.slug,
      })),
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      totalPages: Math.ceil(total / normalizedLimit) || 1,
    };
  }
}
