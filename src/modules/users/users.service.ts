import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';

type PaginationParams = {
  page?: number;
  limit?: number;
  status?: string[];
  difficulty?: string[];
  type?: string[];
  level?: string[];
  activityType?: string;
};

type ActivityType = 'all' | 'challenges' | 'interviews';

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
      yearlyInterviewAttempts,
      recentInterviewAttempts,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          avatarUrl: true,
          createdAt: true,
          provider: true,
          gender: true,
          birthday: true,
          location: true,
          readme: true,
          notifyInterviewActivity: true,
          notifyComments: true,
          notifySound: true,
          deletedAt: true,
          password: true,
        } as any,
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
      (this.prisma.interviewAttempt.findMany as any)({
        where: {
          userId: id,
          status: 'COMPLETED',
          completedAt: {
            gte: oneYearAgo,
            not: null,
          },
          feedback: {
            isNot: null,
          },
        },
        orderBy: { completedAt: 'asc' },
        select: {
          completedAt: true,
        },
      }),
      (this.prisma.interviewAttempt.findMany as any)({
        where: {
          userId: id,
          status: 'COMPLETED',
          completedAt: {
            not: null,
          },
          feedback: {
            isNot: null,
          },
        },
        orderBy: { completedAt: 'desc' },
        take: 10,
        include: {
          interview: {
            select: {
              id: true,
              role: true,
              level: true,
              type: true,
            },
          },
          feedback: {
            select: {
              totalScore: true,
            },
          },
        },
      }),
    ]);

    const solvedByChallenge = new Map<
      string,
      (typeof acceptedSubmissions)[number]
    >();
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
    yearlyInterviewAttempts.forEach((attempt: any) => {
      if (!attempt.completedAt) {
        return;
      }

      const dateKey = this.getDateKeyInTimezone(
        attempt.completedAt,
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

    const { password: _password, ...userWithoutPassword } = (user as any) ?? {};
    return {
      ...userWithoutPassword,
      hasPassword: Boolean((user as any)?.password),
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
      recentActivity: this.mergeRecentActivity(
        recentActivity.map((submission) =>
          this.mapSubmissionActivity(submission),
        ),
        recentInterviewAttempts.map((attempt: any) =>
          this.mapInterviewAttemptActivity(attempt),
        ),
        10,
      ),
    };
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async updateProfile(userId: string, data: UpdateProfileDto, avatar?: any) {
    const updateData: Record<string, any> = {};

    if (data.name?.trim()) {
      updateData.name = data.name.trim();
    }

    if (data.gender !== undefined) {
      updateData.gender = data.gender || null;
    }

    if (data.birthday !== undefined) {
      const birthdayDate = data.birthday instanceof Date ? data.birthday : null;
      if (birthdayDate && birthdayDate.getTime() > Date.now()) {
        throw new BadRequestException('Birthday must be in the past.');
      }
      updateData.birthday = birthdayDate;
    }

    if (data.location !== undefined) {
      const trimmed = (data.location || '').trim();
      updateData.location = trimmed.length > 0 ? trimmed : null;
    }

    if (data.readme !== undefined) {
      updateData.readme = data.readme ?? null;
    }

    if (data.notifyInterviewActivity !== undefined) {
      updateData.notifyInterviewActivity = data.notifyInterviewActivity;
    }

    if (data.notifyComments !== undefined) {
      updateData.notifyComments = data.notifyComments;
    }

    if (data.notifySound !== undefined) {
      updateData.notifySound = data.notifySound;
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

  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if ((user as any).deletedAt) {
      throw new BadRequestException('Account already deleted.');
    }

    if (!user.password) {
      throw new BadRequestException(
        'You must set a password before deleting your account. Visit Settings → Account to set one.',
      );
    }

    if (!dto.password) {
      throw new BadRequestException(
        'Password is required to confirm account deletion.',
      );
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid password.');
    }

    const anonymizedEmail = `deleted-${userId}@deleted.local`;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        email: anonymizedEmail,
        name: 'Deleted User',
        avatarUrl: null,
        password: null,
        provider: null,
        providerId: null,
        gender: null,
        birthday: null,
        location: null,
        readme: null,
        deletedAt: new Date(),
      } as any,
    });

    return { success: true };
  }

  async getProfileForUser(
    targetUserId: string,
    requesterId: string,
    timezone?: string,
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, deletedAt: true } as any,
    });

    if (!target || (target as any).deletedAt) {
      throw new NotFoundException('User not found');
    }

    const [profile, solutionCount, discussCount, interviewSummary] =
      await Promise.all([
        this.findById(targetUserId, timezone),
        this.prisma.challengeSolution.count({
          where: { userId: targetUserId, deletedAt: null } as any,
        }),
        this.prisma.solutionComment.count({
          where: { userId: targetUserId } as any,
        }),
        this.computeInterviewSummary(targetUserId),
      ]);

    const isOwn = requesterId === targetUserId;
    const baseProfile = {
      ...profile,
      solutionCount,
      discussCount,
      interviewSummary,
    };

    if (isOwn) {
      return baseProfile;
    }

    const { email: _email, ...publicProfile } = baseProfile as any;
    return {
      ...publicProfile,
      hasPassword: undefined,
      notifyInterviewActivity: undefined,
      notifyComments: undefined,
      notifySound: undefined,
    };
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

  async getStarredInterviews(userId: string, params: PaginationParams) {
    const page = Math.max(params.page || 1, 1);
    const limit = Math.min(Math.max(params.limit || 10, 1), 50);
    const skip = (page - 1) * limit;
    const interviewStar = (this.prisma as any).interviewStar;
    const normalizedTypes = (params.type || [])
      .map((type) => type.trim())
      .filter((type) => type && type.toLowerCase() !== 'all');
    const normalizedLevels = (params.level || [])
      .map((level) => level.trim())
      .filter((level) => level && level.toLowerCase() !== 'all');

    const interviewWhere: any = {};

    if (normalizedTypes.length > 0) {
      interviewWhere.OR = normalizedTypes.map((type) => ({
        type: {
          contains: type,
          mode: 'insensitive',
        },
      }));
    }

    if (normalizedLevels.length > 0) {
      interviewWhere.level = {
        in: normalizedLevels,
      };
    }

    const starredWhere: any = {
      userId,
    };

    if (Object.keys(interviewWhere).length > 0) {
      starredWhere.interview = interviewWhere;
    }

    const [items, total] = await Promise.all([
      interviewStar.findMany({
        where: starredWhere,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          interview: {
            include: {
              _count: {
                select: {
                  attempts: true,
                },
              },
              feedbacks: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      }),
      interviewStar.count({ where: starredWhere }),
    ]);

    const mappedItems = items.map((item: any) => ({
      id: item.interview.id,
      role: item.interview.role,
      level: item.interview.level,
      questions: item.interview.questions,
      techstack: item.interview.techstack,
      createdAt: item.interview.createdAt,
      userId: item.interview.userId,
      type: item.interview.type,
      language: item.interview.language,
      finalized: item.interview.finalized,
      isStarred: true,
      starredAt: item.createdAt,
      attemptCount: item.interview._count?.attempts || 0,
      feedback: item.interview.feedbacks?.[0] || null,
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

    const uniqueSolved = new Map<
      string,
      (typeof acceptedSubmissions)[number]
    >();
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
    const takeForMerge = skip + limit;
    const activityType = this.normalizeActivityType(params.activityType);
    const completedInterviewWhere = {
      userId,
      status: 'COMPLETED',
      completedAt: {
        not: null,
      },
      feedback: {
        isNot: null,
      },
    };

    const [submissionTotal, interviewTotal] = await Promise.all([
      this.prisma.challengeSubmission.count({
        where: { userId },
      }),
      (this.prisma.interviewAttempt.count as any)({
        where: completedInterviewWhere,
      }),
    ]);

    let items: any[] = [];
    let total = submissionTotal + interviewTotal;

    if (activityType === 'challenges') {
      const submissions = await this.prisma.challengeSubmission.findMany({
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
      });

      items = submissions.map((submission) =>
        this.mapSubmissionActivity(submission),
      );
      total = submissionTotal;
    } else if (activityType === 'interviews') {
      const interviewAttempts = await (
        this.prisma.interviewAttempt.findMany as any
      )({
        where: completedInterviewWhere,
        orderBy: { completedAt: 'desc' },
        skip,
        take: limit,
        include: {
          interview: {
            select: {
              id: true,
              role: true,
              level: true,
              type: true,
            },
          },
          feedback: {
            select: {
              totalScore: true,
            },
          },
        },
      });

      items = interviewAttempts.map((attempt: any) =>
        this.mapInterviewAttemptActivity(attempt),
      );
      total = interviewTotal;
    } else {
      const [submissions, interviewAttempts] = await Promise.all([
        this.prisma.challengeSubmission.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: takeForMerge,
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
        (this.prisma.interviewAttempt.findMany as any)({
          where: completedInterviewWhere,
          orderBy: { completedAt: 'desc' },
          take: takeForMerge,
          include: {
            interview: {
              select: {
                id: true,
                role: true,
                level: true,
                type: true,
              },
            },
            feedback: {
              select: {
                totalScore: true,
              },
            },
          },
        }),
      ]);

      items = this.mergeRecentActivity(
        submissions.map((submission) => this.mapSubmissionActivity(submission)),
        interviewAttempts.map((attempt: any) =>
          this.mapInterviewAttemptActivity(attempt),
        ),
        takeForMerge,
      ).slice(skip, skip + limit);
    }

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      summary: {
        total: submissionTotal + interviewTotal,
        challengeSubmissions: submissionTotal,
        interviewAttempts: interviewTotal,
      },
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
      const scoreDiff =
        (scoreMap.get(b.slug) || 0) - (scoreMap.get(a.slug) || 0);

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return (b._count?.challenges || 0) - (a._count?.challenges || 0);
    });

    return rankedSkills.slice(0, normalizedLimit);
  }

  private getAvatarPublicUrl(filename: string) {
    return `/uploads/avatars/${filename}`;
  }

  private mapSubmissionActivity(submission: any) {
    return {
      id: submission.id,
      activityType: 'CHALLENGE_SUBMISSION',
      challengeId: submission.challengeId,
      challengeTitle: submission.challenge.title,
      difficulty: submission.challenge.difficulty,
      skillSlug: submission.challenge.skill.slug,
      language: submission.language,
      status: submission.status,
      runtime: submission.runtime,
      memory: submission.memory,
      submittedAt: submission.createdAt,
    };
  }

  private mapInterviewAttemptActivity(attempt: any) {
    return {
      id: attempt.id,
      activityType: 'INTERVIEW_ATTEMPT',
      interviewId: attempt.interviewId,
      interviewRole: attempt.interview.role,
      interviewLevel: attempt.interview.level,
      interviewType: attempt.interview.type,
      status: 'COMPLETED',
      score: attempt.feedback?.totalScore ?? null,
      submittedAt: attempt.completedAt,
    };
  }

  async getProfileActivity(
    userId: string,
    params: {
      page?: number;
      limit?: number;
      type?: 'CHALLENGE' | 'INTERVIEW';
    },
  ) {
    const type = params.type ?? 'CHALLENGE';
    const page = Math.max(params.page || 1, 1);
    const limit = Math.min(Math.max(params.limit || 10, 1), 50);
    const skip = (page - 1) * limit;

    if (type === 'CHALLENGE') {
      const [total, submissions] = await Promise.all([
        this.prisma.challengeSubmission.count({ where: { userId } }),
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
                skill: { select: { slug: true } },
              },
            },
          },
        }),
      ]);

      return {
        items: submissions.map((s: any) =>
          this.mapProfileSubmissionActivity(s),
        ),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      };
    }

    const interviewWhere = {
      userId,
      status: { in: ['COMPLETED', 'TOO_SHORT', 'FAILED'] },
    };

    const [total, attempts] = await Promise.all([
      (this.prisma.interviewAttempt.count as any)({ where: interviewWhere }),
      (this.prisma.interviewAttempt.findMany as any)({
        where: interviewWhere,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          interview: {
            select: { id: true, role: true, level: true, type: true },
          },
          feedback: { select: { totalScore: true } },
        },
      }),
    ]);

    return {
      items: attempts.map((a: any) => this.mapProfileInterviewActivity(a)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  private mapProfileSubmissionActivity(submission: any) {
    return {
      activityType: 'CHALLENGE_SUBMISSION' as const,
      id: submission.id,
      createdAt: submission.createdAt,
      challengeId: submission.challengeId,
      challengeTitle: submission.challenge.title,
      skillSlug: submission.challenge.skill.slug,
      difficulty: submission.challenge.difficulty,
      language: submission.language,
      status: submission.status,
      runtime: submission.runtime ?? null,
      memory: submission.memory ?? null,
    };
  }

  private mapProfileInterviewActivity(attempt: any) {
    return {
      activityType: 'INTERVIEW_ATTEMPT' as const,
      id: attempt.id,
      createdAt: attempt.createdAt,
      interviewId: attempt.interviewId,
      interviewRole: attempt.interview.role,
      interviewLevel: attempt.interview.level,
      interviewType: attempt.interview.type,
      status: attempt.status,
      score: attempt.feedback?.totalScore ?? null,
    };
  }

  private mergeRecentActivity(
    submissions: any[],
    interviews: any[],
    limit: number,
  ) {
    return [...submissions, ...interviews]
      .sort(
        (a, b) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
      )
      .slice(0, limit);
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

  private normalizeActivityType(activityType?: string): ActivityType {
    if (activityType === 'challenges' || activityType === 'interviews') {
      return activityType;
    }

    return 'all';
  }

  private async computeInterviewSummary(userId: string) {
    const [created, completedAttempts, attentionAttempts, latest] =
      await Promise.all([
        this.prisma.interview.count({ where: { userId } }),
        (this.prisma.interviewAttempt.count as any)({
          where: {
            userId,
            status: 'COMPLETED',
            feedback: { isNot: null },
          },
        }) as Promise<number>,
        (this.prisma.interviewAttempt.count as any)({
          where: {
            userId,
            status: { in: ['TOO_SHORT', 'FAILED'] },
          },
        }) as Promise<number>,
        (this.prisma.interviewAttempt.findFirst as any)({
          where: {
            userId,
            completedAt: { not: null },
          },
          orderBy: { completedAt: 'desc' },
          select: {
            status: true,
            completedAt: true,
            interview: {
              select: { role: true, level: true },
            },
          },
        }) as Promise<any>,
      ]);

    return {
      created,
      completedAttempts,
      attentionAttempts,
      latestRole: latest?.interview?.role ?? null,
      latestStatus: latest?.status ?? null,
      latestDate: latest?.completedAt ?? null,
    };
  }

  async getProfileActivityForUser(
    targetUserId: string,
    requesterId: string,
    params: {
      page?: number;
      limit?: number;
      type?: 'CHALLENGE' | 'INTERVIEW';
    },
  ) {
    const type = params.type ?? 'CHALLENGE';
    if (type === 'INTERVIEW' && requesterId !== targetUserId) {
      throw new ForbiddenException(
        'Interview activity is private to its owner',
      );
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, deletedAt: true } as any,
    });

    if (!target || (target as any).deletedAt) {
      throw new NotFoundException('User not found');
    }

    return this.getProfileActivity(targetUserId, params);
  }
}
