import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';

export type AdminAuditAction =
  | 'UPDATE_USER_ROLE'
  | 'UPDATE_USER_STATUS'
  | 'CREATE_SKILL'
  | 'UPDATE_SKILL'
  | 'DISABLE_SKILL'
  | 'ENABLE_SKILL'
  | 'CREATE_CHALLENGE'
  | 'UPDATE_CHALLENGE'
  | 'DISABLE_CHALLENGE'
  | 'ENABLE_CHALLENGE'
  | 'ARCHIVE_INTERVIEW'
  | 'RESTORE_INTERVIEW';

export type AdminAuditEntityType =
  | 'USER'
  | 'SKILL'
  | 'CHALLENGE'
  | 'INTERVIEW';

export type AdminAuditContext = {
  adminId: string;
  ipAddress?: string;
  userAgent?: string;
};

type RecordAuditLogParams = AdminAuditContext & {
  action: AdminAuditAction;
  entityType: AdminAuditEntityType;
  entityId?: string;
  entityName?: string;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class AdminAuditLogService {
  private readonly logger = new Logger(AdminAuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(params: RecordAuditLogParams) {
    const {
      adminId,
      action,
      entityType,
      entityId,
      entityName,
      metadata,
      ipAddress,
      userAgent,
    } = params;

    try {
      return await this.prisma.adminAuditLog.create({
        data: {
          adminId,
          action,
          entityType,
          entityId,
          entityName,
          metadata,
          ipAddress,
          userAgent,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record admin audit log: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async getLogs(params: {
    page: number;
    limit: number;
    search?: string;
    action?: string;
    entityType?: string;
  }) {
    const { page, limit, search, action, entityType } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.AdminAuditLogWhereInput = {};

    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { entityType: { contains: search, mode: 'insensitive' } },
        { entityName: { contains: search, mode: 'insensitive' } },
        { admin: { name: { contains: search, mode: 'insensitive' } } },
        { admin: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (action) {
      where.action = action;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    const [items, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          entityName: true,
          metadata: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          admin: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}
