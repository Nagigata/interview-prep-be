import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  AdminAuditContext,
  AdminAuditLogService,
} from './admin-audit-log.service';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AdminAuditLogService,
  ) {}

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

  async updateUser(
    userId: string,
    data: { role?: string; isActive?: boolean },
    auditContext?: AdminAuditContext,
  ) {
    const updateData: any = {};
    if (data.role === 'ADMIN' || data.role === 'USER') {
      updateData.role = data.role;
    }
    if (typeof data.isActive === 'boolean') {
      updateData.isActive = data.isActive;
    }

    const before = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    const updatedUser = await this.prisma.user.update({
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

    if (auditContext && before) {
      if (before.role !== updatedUser.role) {
        await this.auditLogService.record({
          ...auditContext,
          action: 'UPDATE_USER_ROLE',
          entityType: 'USER',
          entityId: updatedUser.id,
          entityName: updatedUser.email,
          metadata: {
            before: { role: before.role },
            after: { role: updatedUser.role },
          },
        });
      }

      if (before.isActive !== updatedUser.isActive) {
        await this.auditLogService.record({
          ...auditContext,
          action: 'UPDATE_USER_STATUS',
          entityType: 'USER',
          entityId: updatedUser.id,
          entityName: updatedUser.email,
          metadata: {
            before: { isActive: before.isActive },
            after: { isActive: updatedUser.isActive },
          },
        });
      }
    }

    return updatedUser;
  }
}
