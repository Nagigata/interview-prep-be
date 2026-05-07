import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private getTimeBuckets(range = '6m') {
    const now = new Date();
    const normalizedRange = ['7d', '30d', '6m', '12m'].includes(range)
      ? range
      : '6m';
    const isDaily = normalizedRange === '7d' || normalizedRange === '30d';
    const count =
      normalizedRange === '7d'
        ? 7
        : normalizedRange === '30d'
          ? 30
          : normalizedRange === '12m'
            ? 12
            : 6;
    const buckets: { key: string; label: string; start: Date }[] = [];

    for (let index = count - 1; index >= 0; index -= 1) {
      const date = isDaily
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - index)
        : new Date(now.getFullYear(), now.getMonth() - index, 1);
      const key = isDaily
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
            2,
            '0',
          )}-${String(date.getDate()).padStart(2, '0')}`
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
            2,
            '0',
          )}`;
      const label = isDaily
        ? date.toLocaleString('en-US', { month: 'short', day: '2-digit' })
        : date.toLocaleString('en-US', { month: 'short' });

      buckets.push({ key, label, start: date });
    }

    return {
      range: normalizedRange,
      buckets,
      startDate: buckets[0].start,
      sqlDateFormat: isDaily ? 'YYYY-MM-DD' : 'YYYY-MM',
    };
  }

  private normalizeMonthlyRows(
    buckets: { key: string; label: string }[],
    rows: { month: string; count: bigint }[],
  ) {
    const countByMonth = new Map(
      rows.map((row) => [row.month, Number(row.count)]),
    );

    return buckets.map((bucket) => ({
      month: bucket.label,
      monthKey: bucket.key,
      count: countByMonth.get(bucket.key) ?? 0,
    }));
  }

  private calculateGrowthPercent(data: { count: number }[]) {
    const current = data.at(-1)?.count ?? 0;
    const previous = data.at(-2)?.count ?? 0;

    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }

    return Math.round(((current - previous) / previous) * 100);
  }

  async getDashboardStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalInterviews,
      totalAttempts,
      totalChallenges,
      totalSubmissions,
      totalSkills,
      usersToday,
      interviewsToday,
      attemptsToday,
      submissionsToday,
      activeChallenges,
      disabledChallenges,
      activeSkills,
      disabledSkills,
      recentUsers,
      recentSubmissions,
      recentInterviews,
      topSkills,
      topChallengeGroups,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.interview.count(),
      this.prisma.interviewAttempt.count(),
      this.prisma.challenge.count(),
      this.prisma.challengeSubmission.count(),
      this.prisma.skill.count(),
      this.prisma.user.count({
        where: { createdAt: { gte: startOfToday } },
      }),
      this.prisma.interview.count({
        where: { createdAt: { gte: startOfToday } },
      }),
      this.prisma.interviewAttempt.count({
        where: { createdAt: { gte: startOfToday } },
      }),
      this.prisma.challengeSubmission.count({
        where: { createdAt: { gte: startOfToday } },
      }),
      this.prisma.challenge.count({ where: { isActive: true } }),
      this.prisma.challenge.count({ where: { isActive: false } }),
      this.prisma.skill.count({ where: { isActive: true } }),
      this.prisma.skill.count({ where: { isActive: false } }),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
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
      this.prisma.interview.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          role: true,
          level: true,
          type: true,
          techstack: true,
          archivedAt: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
          _count: { select: { attempts: true } },
        },
      }),
      this.prisma.$queryRaw<
        {
          id: string;
          name: string;
          slug: string;
          isActive: boolean;
          challengeCount: bigint;
        }[]
      >`
        SELECT
          skills.id,
          skills.name,
          skills.slug,
          skills.is_active as "isActive",
          COUNT(challenges.id)::bigint as "challengeCount"
        FROM skills
        LEFT JOIN challenges ON challenges.skill_id = skills.id
        GROUP BY skills.id
        ORDER BY "challengeCount" DESC, skills.created_at DESC
        LIMIT 5
      `,
      this.prisma.$queryRaw<
        {
          challengeId: string;
          submissionCount: bigint;
        }[]
      >`
        SELECT
          challenge_id as "challengeId",
          COUNT(*)::bigint as "submissionCount"
        FROM challenge_submissions
        GROUP BY challenge_id
        ORDER BY "submissionCount" DESC
        LIMIT 5
      `,
    ]);

    const topChallengeIds = topChallengeGroups.map((group) => group.challengeId);
    const topChallengeRows = topChallengeIds.length
      ? await this.prisma.challenge.findMany({
          where: { id: { in: topChallengeIds } },
          select: {
            id: true,
            title: true,
            difficulty: true,
            isActive: true,
            skill: { select: { name: true } },
          },
        })
      : [];
    const topChallengeMap = new Map(
      topChallengeRows.map((challenge) => [challenge.id, challenge]),
    );

    return {
      totalUsers,
      totalInterviews,
      totalAttempts,
      totalChallenges,
      totalSubmissions,
      totalSkills,
      usersToday,
      interviewsToday,
      attemptsToday,
      submissionsToday,
      activeChallenges,
      disabledChallenges,
      activeSkills,
      disabledSkills,
      recentUsers,
      recentSubmissions: recentSubmissions.map((submission) => ({
        id: submission.id,
        status: submission.status,
        language: submission.language,
        createdAt: submission.createdAt,
        userName: submission.user.name,
        challengeTitle: submission.challenge.title,
      })),
      recentInterviews: recentInterviews.map((interview) => ({
        id: interview.id,
        role: interview.role,
        level: interview.level,
        type: interview.type,
        techstack: interview.techstack,
        createdAt: interview.createdAt,
        status: interview.archivedAt ? 'Archived' : 'Active',
        userName: interview.user.name,
        userEmail: interview.user.email,
        attempts: interview._count.attempts,
      })),
      topSkills: topSkills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        slug: skill.slug,
        isActive: skill.isActive,
        challengeCount: Number(skill.challengeCount),
      })),
      topChallenges: topChallengeGroups
        .map((group) => {
          const challenge = topChallengeMap.get(group.challengeId);
          if (!challenge) {
            return null;
          }

          return {
            id: challenge.id,
            title: challenge.title,
            difficulty: challenge.difficulty,
            isActive: challenge.isActive,
            skillName: challenge.skill.name,
            submissionCount: Number(group.submissionCount),
          };
        })
        .filter(Boolean),
    };
  }

  async getStats(range = '6m') {
    const { range: selectedRange, buckets, startDate, sqlDateFormat } =
      this.getTimeBuckets(range);

    const [
      usersByMonth,
      submissionsByMonth,
      interviewsByMonth,
      submissionsByStatus,
    ] = await Promise.all([
      this.prisma.$queryRaw<{ month: string; count: bigint }[]>`
        SELECT TO_CHAR(created_at, ${sqlDateFormat}) as month, COUNT(*)::bigint as count
        FROM users
        WHERE created_at >= ${startDate}
        GROUP BY month ORDER BY month
      `,
      this.prisma.$queryRaw<{ month: string; count: bigint }[]>`
        SELECT TO_CHAR(created_at, ${sqlDateFormat}) as month, COUNT(*)::bigint as count
        FROM challenge_submissions
        WHERE created_at >= ${startDate}
        GROUP BY month ORDER BY month
      `,
      this.prisma.$queryRaw<{ month: string; count: bigint }[]>`
        SELECT TO_CHAR(created_at, ${sqlDateFormat}) as month, COUNT(*)::bigint as count
        FROM interviews
        WHERE created_at >= ${startDate}
        GROUP BY month ORDER BY month
      `,
      this.prisma.challengeSubmission.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: { createdAt: { gte: startDate } },
      }),
    ]);

    const userGrowth = this.normalizeMonthlyRows(buckets, usersByMonth);
    const submissionTrend = this.normalizeMonthlyRows(
      buckets,
      submissionsByMonth,
    );
    const interviewTrend = this.normalizeMonthlyRows(
      buckets,
      interviewsByMonth,
    );
    const statusBreakdown = submissionsByStatus.map((statusGroup) => ({
      status: statusGroup.status,
      count: statusGroup._count._all,
    }));
    const totalSubmissionCount = statusBreakdown.reduce(
      (total, item) => total + item.count,
      0,
    );
    const acceptedSubmissionCount =
      statusBreakdown.find((item) => item.status === 'ACCEPTED')?.count ?? 0;
    const submissionSuccessRate =
      totalSubmissionCount > 0
        ? Math.round((acceptedSubmissionCount / totalSubmissionCount) * 100)
        : 0;

    return {
      range: selectedRange,
      userGrowth,
      submissionTrend,
      interviewTrend,
      growth: {
        users: this.calculateGrowthPercent(userGrowth),
        submissions: this.calculateGrowthPercent(submissionTrend),
        interviews: this.calculateGrowthPercent(interviewTrend),
      },
      submissionSuccessRate: {
        rate: submissionSuccessRate,
        accepted: acceptedSubmissionCount,
        total: totalSubmissionCount,
        breakdown: statusBreakdown,
      },
    };
  }
}
