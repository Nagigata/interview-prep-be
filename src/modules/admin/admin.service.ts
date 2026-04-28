import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { Difficulty } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== DASHBOARD =====

  async getDashboardStats() {
    const [
      totalUsers,
      totalInterviews,
      totalAttempts,
      totalChallenges,
      totalSubmissions,
      totalSkills,
      recentUsers,
      recentSubmissions,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.interview.count(),
      this.prisma.interviewAttempt.count(),
      this.prisma.challenge.count(),
      this.prisma.challengeSubmission.count(),
      this.prisma.skill.count(),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      }),
      this.prisma.challengeSubmission.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          status: true,
          language: true,
          createdAt: true,
          user: { select: { name: true } },
          challenge: { select: { title: true } },
        },
      }),
    ]);

    return {
      totalUsers,
      totalInterviews,
      totalAttempts,
      totalChallenges,
      totalSubmissions,
      totalSkills,
      recentUsers,
      recentSubmissions: recentSubmissions.map((s) => ({
        id: s.id,
        status: s.status,
        language: s.language,
        createdAt: s.createdAt,
        userName: s.user.name,
        challengeTitle: s.challenge.title,
      })),
    };
  }

  // ===== STATS (CHARTS) =====

  async getStats() {
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    const [usersByMonth, submissionsByMonth, interviewsByMonth, submissionsByStatus] =
      await Promise.all([
        this.prisma.$queryRaw<{ month: string; count: bigint }[]>`
          SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*)::bigint as count
          FROM users
          WHERE created_at >= ${sixMonthsAgo}
          GROUP BY month ORDER BY month
        `,
        this.prisma.$queryRaw<{ month: string; count: bigint }[]>`
          SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*)::bigint as count
          FROM challenge_submissions
          WHERE created_at >= ${sixMonthsAgo}
          GROUP BY month ORDER BY month
        `,
        this.prisma.$queryRaw<{ month: string; count: bigint }[]>`
          SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*)::bigint as count
          FROM interviews
          WHERE created_at >= ${sixMonthsAgo}
          GROUP BY month ORDER BY month
        `,
        this.prisma.challengeSubmission.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
      ]);

    return {
      userGrowth: usersByMonth.map((r) => ({ month: r.month, count: Number(r.count) })),
      submissionTrend: submissionsByMonth.map((r) => ({
        month: r.month,
        count: Number(r.count),
      })),
      interviewTrend: interviewsByMonth.map((r) => ({
        month: r.month,
        count: Number(r.count),
      })),
      submissionsByStatus: submissionsByStatus.map((s) => ({
        status: s.status,
        count: s._count._all,
      })),
    };
  }

  // ===== USERS =====

  async getUsers(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          provider: true,
          avatarUrl: true,
          createdAt: true,
          _count: {
            select: {
              interviews: true,
              challengeSubmissions: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => ({
        ...u,
        totalInterviews: u._count.interviews,
        totalSubmissions: u._count.challengeSubmissions,
        _count: undefined,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getUserDetail(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        provider: true,
        avatarUrl: true,
        createdAt: true,
        _count: {
          select: {
            interviews: true,
            interviewAttempts: true,
            challengeSubmissions: true,
            challengeStars: true,
            feedbacks: true,
          },
        },
      },
    });
  }

  async updateUser(userId: string, data: { role?: string }) {
    const updateData: any = {};
    if (data.role === 'ADMIN' || data.role === 'USER') {
      updateData.role = data.role;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });
  }

  // ===== INTERVIEWS =====

  async getInterviews(params: { page: number; limit: number; search?: string }) {
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
      items: items.map((i) => ({
        ...i,
        totalAttempts: i._count.attempts,
        totalFeedbacks: i._count.feedbacks,
        _count: undefined,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // ===== CHALLENGES =====

  async getChallenges(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { topics: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.challenge.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          slug: true,
          difficulty: true,
          topics: true,
          createdAt: true,
          skill: { select: { id: true, name: true, slug: true } },
          _count: { select: { submissions: true } },
        },
      }),
      this.prisma.challenge.count({ where }),
    ]);

    return {
      items: items.map((c) => ({
        ...c,
        totalSubmissions: c._count.submissions,
        _count: undefined,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async createChallenge(data: {
    skillId: string;
    title: string;
    slug: string;
    description: string;
    difficulty: string;
    topics?: string;
    templateCode: any;
    testCases: any;
    examples?: any;
    constraints?: any;
    hints?: any;
  }) {
    return this.prisma.challenge.create({
      data: {
        skillId: data.skillId,
        title: data.title,
        slug: data.slug,
        description: data.description,
        difficulty: data.difficulty as Difficulty,
        topics: data.topics || '',
        templateCode: data.templateCode,
        testCases: data.testCases,
        examples: data.examples,
        constraints: data.constraints,
        hints: data.hints,
      },
    });
  }

  async updateChallenge(
    challengeId: string,
    data: {
      title?: string;
      description?: string;
      difficulty?: string;
      topics?: string;
      templateCode?: any;
      testCases?: any;
      examples?: any;
      constraints?: any;
      hints?: any;
    },
  ) {
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.difficulty !== undefined) updateData.difficulty = data.difficulty;
    if (data.topics !== undefined) updateData.topics = data.topics;
    if (data.templateCode !== undefined) updateData.templateCode = data.templateCode;
    if (data.testCases !== undefined) updateData.testCases = data.testCases;
    if (data.examples !== undefined) updateData.examples = data.examples;
    if (data.constraints !== undefined) updateData.constraints = data.constraints;
    if (data.hints !== undefined) updateData.hints = data.hints;

    return this.prisma.challenge.update({
      where: { id: challengeId },
      data: updateData,
    });
  }

  async deleteChallenge(challengeId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.challengeSubmission.deleteMany({ where: { challengeId } });
      await tx.challengeStar.deleteMany({ where: { challengeId } });
      return tx.challenge.delete({ where: { id: challengeId } });
    });
  }

  // ===== SKILLS =====

  async getSkills() {
    return this.prisma.skill.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { challenges: true } },
      },
    });
  }

  async createSkill(data: { name: string; slug: string; description?: string; icon?: string }) {
    return this.prisma.skill.create({ data });
  }

  async updateSkill(
    skillId: string,
    data: { name?: string; description?: string; icon?: string },
  ) {
    return this.prisma.skill.update({
      where: { id: skillId },
      data,
    });
  }
}
