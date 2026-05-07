import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

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
    ]);

    return {
      totalUsers,
      totalInterviews,
      totalAttempts,
      totalChallenges,
      totalSubmissions,
      totalSkills,
      recentUsers,
      recentSubmissions: recentSubmissions.map((submission) => ({
        id: submission.id,
        status: submission.status,
        language: submission.language,
        createdAt: submission.createdAt,
        userName: submission.user.name,
        challengeTitle: submission.challenge.title,
      })),
    };
  }

  async getStats() {
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    const [
      usersByMonth,
      submissionsByMonth,
      interviewsByMonth,
      submissionsByStatus,
    ] = await Promise.all([
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
      userGrowth: usersByMonth.map((row) => ({
        month: row.month,
        count: Number(row.count),
      })),
      submissionTrend: submissionsByMonth.map((row) => ({
        month: row.month,
        count: Number(row.count),
      })),
      interviewTrend: interviewsByMonth.map((row) => ({
        month: row.month,
        count: Number(row.count),
      })),
      submissionsByStatus: submissionsByStatus.map((statusGroup) => ({
        status: statusGroup.status,
        count: statusGroup._count._all,
      })),
    };
  }
}
