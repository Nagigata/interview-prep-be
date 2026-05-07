import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsers(params: {
    page: number;
    limit: number;
    search?: string;
    role?: string;
    status?: string;
  }) {
    const { page, limit, search, role, status } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role === 'ADMIN' || role === 'USER') {
      where.role = role;
    }
    if (status === 'active') {
      where.isActive = true;
    }
    if (status === 'inactive') {
      where.isActive = false;
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
          isActive: true,
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
      items: items.map((user) => ({
        ...user,
        totalInterviews: user._count.interviews,
        totalSubmissions: user._count.challengeSubmissions,
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
        isActive: true,
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

  async updateUser(userId: string, data: { role?: string; isActive?: boolean }) {
    const updateData: any = {};
    if (data.role === 'ADMIN' || data.role === 'USER') {
      updateData.role = data.role;
    }
    if (typeof data.isActive === 'boolean') {
      updateData.isActive = data.isActive;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });
  }
}
