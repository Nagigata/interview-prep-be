import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

type PaginationParams = {
  page?: number;
  limit?: number;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 364);
    oneYearAgo.setHours(0, 0, 0, 0);

    const [
      user,
      starredCount,
      totalInterviewCount,
      totalSubmissionCount,
      acceptedSubmissionCount,
      attemptedChallengeGroups,
      totalChallengeCounts,
      acceptedSubmissions,
      recentActivity,
      yearlySubmissions,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          createdAt: true,
        },
      }),
      this.prisma.challengeStar.count({
        where: { userId: id },
      }),
      this.prisma.interview.count({
        where: { userId: id },
      }),
      this.prisma.challengeSubmission.count({
        where: { userId: id },
      }),
      this.prisma.challengeSubmission.count({
        where: { userId: id, status: 'ACCEPTED' },
      }),
      this.prisma.challengeSubmission.groupBy({
        by: ['challengeId'],
        where: { userId: id },
      }),
      this.prisma.challenge.groupBy({
        by: ['difficulty'],
        _count: {
          _all: true,
        },
      }),
      this.prisma.challengeSubmission.findMany({
        where: { userId: id, status: 'ACCEPTED' },
        orderBy: { createdAt: 'desc' },
        include: {
          challenge: {
            select: {
              id: true,
              difficulty: true,
            },
          },
        },
      }),
      this.prisma.challengeSubmission.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          challenge: {
            select: {
              id: true,
              title: true,
              difficulty: true,
            },
          },
        },
      }),
      this.prisma.challengeSubmission.findMany({
        where: {
          userId: id,
          createdAt: {
            gte: oneYearAgo,
          },
        },
        orderBy: { createdAt: 'asc' },
        select: {
          createdAt: true,
        },
      }),
    ]);

    const solvedByChallenge = new Map<string, (typeof acceptedSubmissions)[number]>();
    acceptedSubmissions.forEach((submission) => {
      if (!solvedByChallenge.has(submission.challengeId)) {
        solvedByChallenge.set(submission.challengeId, submission);
      }
    });

    const solvedChallengeCount = solvedByChallenge.size;
    const attemptedChallengeCount = attemptedChallengeGroups.length;
    const attemptingChallengeCount = Math.max(
      attemptedChallengeCount - solvedChallengeCount,
      0,
    );
    const solvedDifficultyCounts = {
      EASY: 0,
      MEDIUM: 0,
      HARD: 0,
    };

    solvedByChallenge.forEach((submission) => {
      solvedDifficultyCounts[submission.challenge.difficulty] += 1;
    });

    const totalDifficultyCounts = {
      EASY: 0,
      MEDIUM: 0,
      HARD: 0,
    };

    totalChallengeCounts.forEach((entry) => {
      totalDifficultyCounts[entry.difficulty] = entry._count._all;
    });

    const acceptanceRate =
      totalSubmissionCount === 0
        ? 0
        : Math.round((acceptedSubmissionCount / totalSubmissionCount) * 100);

    const activityMap = new Map<string, number>();
    yearlySubmissions.forEach((submission) => {
      const dateKey = submission.createdAt.toISOString().slice(0, 10);
      activityMap.set(dateKey, (activityMap.get(dateKey) || 0) + 1);
    });

    const activityCalendar = this.buildActivityCalendar(oneYearAgo, activityMap);
    const streakInfo = this.calculateStreaks(activityCalendar);

    return {
      ...user,
      stats: {
        totalStarredChallenges: starredCount,
        totalSolvedChallenges: solvedChallengeCount,
        totalSubmissions: totalSubmissionCount,
        acceptedSubmissions: acceptedSubmissionCount,
        acceptanceRate,
        totalInterviews: totalInterviewCount,
        attemptedChallenges: attemptedChallengeCount,
        attemptingChallenges: attemptingChallengeCount,
        activeDays: streakInfo.activeDays,
        currentStreak: streakInfo.currentStreak,
        maxStreak: streakInfo.maxStreak,
        difficultyProgress: {
          easy: {
            solved: solvedDifficultyCounts.EASY,
            total: totalDifficultyCounts.EASY,
          },
          medium: {
            solved: solvedDifficultyCounts.MEDIUM,
            total: totalDifficultyCounts.MEDIUM,
          },
          hard: {
            solved: solvedDifficultyCounts.HARD,
            total: totalDifficultyCounts.HARD,
          },
        },
      },
      activityCalendar,
      recentActivity: recentActivity.map((submission) => ({
        id: submission.id,
        challengeId: submission.challengeId,
        challengeTitle: submission.challenge.title,
        difficulty: submission.challenge.difficulty,
        language: submission.language,
        status: submission.status,
        submittedAt: submission.createdAt,
      })),
    };
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async updateProfile(
    userId: string,
    data: { name?: string },
    avatar?: any,
  ) {
    const updateData: { name?: string; avatarUrl?: string } = {};

    if (data.name?.trim()) {
      updateData.name = data.name.trim();
    }

    if (avatar) {
      updateData.avatarUrl = this.getAvatarPublicUrl(avatar.filename);
    }

    if (Object.keys(updateData).length === 0) {
      return this.findById(userId);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return this.findById(userId);
  }

  async getStarredChallenges(userId: string, params: PaginationParams) {
    const page = Math.max(params.page || 1, 1);
    const limit = Math.min(Math.max(params.limit || 10, 1), 50);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.challengeStar.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          challenge: {
            select: {
              id: true,
              title: true,
              slug: true,
              description: true,
              difficulty: true,
              topics: true,
              skill: {
                select: {
                  slug: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.challengeStar.count({ where: { userId } }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.challenge.id,
        title: item.challenge.title,
        slug: item.challenge.slug,
        description: item.challenge.description,
        difficulty: item.challenge.difficulty,
        topics: item.challenge.topics,
        skillSlug: item.challenge.skill.slug,
        skillName: item.challenge.skill.name,
        isSolved: false,
        isStarred: true,
        starredAt: item.createdAt,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getSolvedChallenges(userId: string, params: PaginationParams) {
    const page = Math.max(params.page || 1, 1);
    const limit = Math.min(Math.max(params.limit || 10, 1), 50);

    const acceptedSubmissions = await this.prisma.challengeSubmission.findMany({
      where: {
        userId,
        status: 'ACCEPTED',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        challenge: {
          select: {
            id: true,
            title: true,
            slug: true,
            difficulty: true,
            topics: true,
            skill: {
              select: {
                slug: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const uniqueSolved = new Map<string, (typeof acceptedSubmissions)[number]>();
    acceptedSubmissions.forEach((submission) => {
      if (!uniqueSolved.has(submission.challengeId)) {
        uniqueSolved.set(submission.challengeId, submission);
      }
    });

    const solvedItems = Array.from(uniqueSolved.values());
    const total = solvedItems.length;
    const start = (page - 1) * limit;
    const paginatedItems = solvedItems.slice(start, start + limit);

    return {
      items: paginatedItems.map((submission) => ({
        challengeId: submission.challengeId,
        title: submission.challenge.title,
        slug: submission.challenge.slug,
        difficulty: submission.challenge.difficulty,
        topics: submission.challenge.topics,
        skillSlug: submission.challenge.skill.slug,
        skillName: submission.challenge.skill.name,
        language: submission.language,
        solvedAt: submission.createdAt,
        status: submission.status,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getRecentActivity(userId: string, params: PaginationParams) {
    const page = Math.max(params.page || 1, 1);
    const limit = Math.min(Math.max(params.limit || 20, 1), 50);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.challengeSubmission.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          challenge: {
            select: {
              id: true,
              title: true,
              difficulty: true,
            },
          },
        },
      }),
      this.prisma.challengeSubmission.count({
        where: { userId },
      }),
    ]);

    return {
      items: items.map((submission) => ({
        id: submission.id,
        challengeId: submission.challengeId,
        challengeTitle: submission.challenge.title,
        difficulty: submission.challenge.difficulty,
        language: submission.language,
        status: submission.status,
        runtime: submission.runtime,
        memory: submission.memory,
        submittedAt: submission.createdAt,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  private getAvatarPublicUrl(filename: string) {
    const port = process.env.PORT || '3001';
    const baseUrl = process.env.APP_URL || `http://localhost:${port}`;
    return `${baseUrl}/uploads/avatars/${filename}`;
  }

  private buildActivityCalendar(startDate: Date, activityMap: Map<string, number>) {
    const calendar: { date: string; count: number; level: number }[] = [];
    const cursor = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    while (cursor <= today) {
      const dateKey = cursor.toISOString().slice(0, 10);
      const count = activityMap.get(dateKey) || 0;
      calendar.push({
        date: dateKey,
        count,
        level: this.getActivityLevel(count),
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return calendar;
  }

  private calculateStreaks(
    calendar: { date: string; count: number; level: number }[],
  ) {
    let currentStreak = 0;
    let maxStreak = 0;
    let runningStreak = 0;
    let activeDays = 0;

    calendar.forEach((entry) => {
      if (entry.count > 0) {
        activeDays += 1;
        runningStreak += 1;
        maxStreak = Math.max(maxStreak, runningStreak);
      } else {
        runningStreak = 0;
      }
    });

    for (let index = calendar.length - 1; index >= 0; index -= 1) {
      if (calendar[index].count > 0) {
        currentStreak += 1;
      } else {
        break;
      }
    }

    return {
      currentStreak,
      maxStreak,
      activeDays,
    };
  }

  private getActivityLevel(count: number) {
    if (count === 0) return 0;
    if (count === 1) return 1;
    if (count <= 3) return 2;
    if (count <= 5) return 3;
    return 4;
  }
}
