import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

type PaginationParams = {
  page?: number;
  limit?: number;
  status?: string[];
  difficulty?: string[];
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, timezone?: string) {
    const userTimezone = this.normalizeTimezone(timezone);
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
              skill: {
                select: {
                  slug: true,
                },
              },
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
      const dateKey = this.getDateKeyInTimezone(
        submission.createdAt,
        userTimezone,
      );
      activityMap.set(dateKey, (activityMap.get(dateKey) || 0) + 1);
    });

    const activityCalendar = this.buildActivityCalendar(
      oneYearAgo,
      activityMap,
      userTimezone,
    );
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
        skillSlug: submission.challenge.skill.slug,
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
    const normalizedStatuses = (params.status || []).map((status) =>
      status.toUpperCase(),
    );
    const normalizedDifficulties = params.difficulty || [];

    const acceptedSubmissions = await this.prisma.challengeSubmission.findMany({
      where: {
        userId,
        status: 'ACCEPTED',
      },
      select: {
        challengeId: true,
      },
    });

    const solvedChallengeIds = new Set(
      acceptedSubmissions.map((submission) => submission.challengeId),
    );

    const starredWhere: any = {
      userId,
    };

    if (normalizedDifficulties.length > 0) {
      starredWhere.challenge = {
        difficulty: {
          in: normalizedDifficulties,
        },
      };
    }

    if (normalizedStatuses.length > 0) {
      const hasSolved = normalizedStatuses.includes('SOLVED');
      const hasUnsolved = normalizedStatuses.includes('UNSOLVED');

      if (hasSolved && !hasUnsolved) {
        starredWhere.challenge = {
          ...(starredWhere.challenge || {}),
          submissions: {
            some: {
              userId,
              status: 'ACCEPTED',
            },
          },
        };
      } else if (!hasSolved && hasUnsolved) {
        starredWhere.challenge = {
          ...(starredWhere.challenge || {}),
          submissions: {
            none: {
              userId,
              status: 'ACCEPTED',
            },
          },
        };
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.challengeStar.findMany({
        where: starredWhere,
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
      this.prisma.challengeStar.count({ where: starredWhere }),
    ]);

    const mappedItems = items.map((item) => ({
      id: item.challenge.id,
      title: item.challenge.title,
      slug: item.challenge.slug,
      description: item.challenge.description,
      difficulty: item.challenge.difficulty,
      topics: item.challenge.topics,
      skillSlug: item.challenge.skill.slug,
      skillName: item.challenge.skill.name,
      isSolved: solvedChallengeIds.has(item.challenge.id),
      isStarred: true,
      starredAt: item.createdAt,
    }));

    return {
      items: mappedItems,
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
              skill: {
                select: {
                  slug: true,
                },
              },
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
        skillSlug: submission.challenge.skill.slug,
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

  async getRecommendedSkills(userId: string, limit = 3) {
    const normalizedLimit = Math.min(Math.max(limit || 3, 1), 10);

    const [skills, recentSubmissions] = await Promise.all([
      this.prisma.skill.findMany({
        include: {
          _count: {
            select: {
              challenges: true,
            },
          },
        },
      }),
      this.prisma.challengeSubmission.findMany({
        where: {
          userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
        select: {
          challenge: {
            select: {
              skill: {
                select: {
                  slug: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const scoreMap = new Map<string, number>();

    recentSubmissions.forEach((submission, index) => {
      const score = recentSubmissions.length - index;
      const skillSlug = submission.challenge.skill.slug;
      scoreMap.set(skillSlug, (scoreMap.get(skillSlug) || 0) + score);
    });

    const rankedSkills = [...skills].sort((a, b) => {
      const scoreDiff = (scoreMap.get(b.slug) || 0) - (scoreMap.get(a.slug) || 0);

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return (b._count?.challenges || 0) - (a._count?.challenges || 0);
    });

    return rankedSkills.slice(0, normalizedLimit);
  }

  private getAvatarPublicUrl(filename: string) {
    const port = process.env.PORT || '3001';
    const baseUrl = process.env.APP_URL || `http://localhost:${port}`;
    return `${baseUrl}/uploads/avatars/${filename}`;
  }

  private buildActivityCalendar(
    startDate: Date,
    activityMap: Map<string, number>,
    timezone: string,
  ) {
    const calendar: { date: string; count: number; level: number }[] = [];
    let cursorKey = this.getDateKeyInTimezone(startDate, timezone);
    const todayKey = this.getDateKeyInTimezone(new Date(), timezone);

    while (cursorKey <= todayKey) {
      const count = activityMap.get(cursorKey) || 0;
      calendar.push({
        date: cursorKey,
        count,
        level: this.getActivityLevel(count),
      });
      cursorKey = this.addOneDay(cursorKey);
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

  private normalizeTimezone(timezone?: string) {
    const fallback = 'UTC';

    if (!timezone) {
      return fallback;
    }

    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
      return timezone;
    } catch {
      return fallback;
    }
  }

  private getDateKeyInTimezone(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    );

    return `${values.year}-${values.month}-${values.day}`;
  }

  private addOneDay(dateKey: string) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + 1));
    return date.toISOString().slice(0, 10);
  }
}
