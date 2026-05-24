import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

export type NotificationKind =
  | 'INTERVIEW_GENERATION_PROCESSING'
  | 'INTERVIEW_GENERATION_COMPLETED'
  | 'INTERVIEW_GENERATION_FAILED'
  | 'FEEDBACK_GENERATION_PROCESSING'
  | 'FEEDBACK_GENERATION_COMPLETED'
  | 'FEEDBACK_GENERATION_FAILED'
  | 'CHALLENGE_NEW_COMMENT'
  | 'CHALLENGE_COMMENT_REPLY'
  | 'CHALLENGE_COMMENT_MENTION'
  | 'SYSTEM';

export type NotificationPreferences = {
  notifyInterviewActivity: boolean;
  notifyComments: boolean;
};

export function checkTypePreference(
  prefs: NotificationPreferences,
  type: NotificationKind,
): boolean {
  if (type === 'SYSTEM') return true;
  if (
    type.startsWith('INTERVIEW_GENERATION') ||
    type.startsWith('FEEDBACK_GENERATION')
  ) {
    return prefs.notifyInterviewActivity;
  }
  if (type.startsWith('CHALLENGE_')) {
    return prefs.notifyComments;
  }
  return true;
}

type CreateNotificationInput = {
  userId: string;
  type: Exclude<
    NotificationKind,
    'INTERVIEW_GENERATION_PROCESSING' | 'FEEDBACK_GENERATION_PROCESSING'
  >;
  title: string;
  message: string;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
};

type RealtimeNotificationInput = {
  id: string;
  type: NotificationKind;
  title: string;
  message: string;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
};

type FindNotificationsQuery = {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async create(input: CreateNotificationInput) {
    const allowed = await this.shouldNotify(input.userId, input.type);
    if (!allowed) {
      return null;
    }

    const notification = await this.notifications.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        actionUrl: input.actionUrl,
        metadata: input.metadata,
      },
    });

    this.gateway.emitNotificationCreated(input.userId, notification);
    return notification;
  }

  async emitRealtime(userId: string, notification: RealtimeNotificationInput) {
    const allowed = await this.shouldNotify(userId, notification.type);
    if (!allowed) {
      return;
    }

    this.gateway.emitNotificationCreated(userId, {
      ...notification,
      readAt: null,
      createdAt: new Date().toISOString(),
    });
  }

  private async shouldNotify(
    userId: string,
    type: NotificationKind,
  ): Promise<boolean> {
    if (type === 'SYSTEM') return true;
    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        notifyInterviewActivity: true,
        notifyComments: true,
      } as any,
    })) as any;
    if (!user) return false;
    return checkTypePreference(
      {
        notifyInterviewActivity: Boolean(user.notifyInterviewActivity),
        notifyComments: Boolean(user.notifyComments),
      },
      type,
    );
  }

  async findMine(userId: string, query: FindNotificationsQuery = {}) {
    const page = this.normalizePage(query.page);
    const limit = this.normalizeLimit(query.limit);
    const where = {
      userId,
      ...(query.unreadOnly ? { readAt: null } : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      this.notifications.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.notifications.count({ where }),
      this.notifications.count({ where: { userId, readAt: null } }),
    ]);

    return {
      items,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.notifications.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const updated = await this.notifications.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    this.gateway.emitNotificationsRead(userId, { ids: [notificationId] });
    return updated;
  }

  async markAllAsRead(userId: string) {
    const result = await this.notifications.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    this.gateway.emitNotificationsRead(userId, { all: true });
    return { count: result.count };
  }

  private normalizePage(value?: number) {
    const page = Number(value);
    return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  }

  private normalizeLimit(value?: number) {
    const limit = Number(value);
    if (!Number.isFinite(limit) || limit <= 0) return 10;
    return Math.min(Math.floor(limit), 50);
  }

  private get notifications() {
    return (this.prisma as any).notification;
  }
}
