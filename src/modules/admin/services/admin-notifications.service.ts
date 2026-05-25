import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { BroadcastAudience } from '../dto/admin.dto';
import {
  AdminAuditContext,
  AdminAuditLogService,
} from './admin-audit-log.service';

type SendUserNotificationInput = {
  title: string;
  message: string;
  actionUrl?: string;
};

type BroadcastInput = {
  title: string;
  message: string;
  actionUrl?: string;
  audience: BroadcastAudience;
};

@Injectable()
export class AdminNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AdminAuditLogService,
  ) {}

  async sendToUser(
    userId: string,
    input: SendUserNotificationInput,
    auditContext: AdminAuditContext,
  ) {
    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        deletedAt: true,
      } as any,
    })) as any;

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    const notification = await this.notificationsService.create({
      userId,
      type: 'SYSTEM',
      title: input.title,
      message: input.message,
      actionUrl: input.actionUrl ?? null,
    });

    await this.auditLogService.record({
      ...auditContext,
      action: 'SEND_USER_NOTIFICATION',
      entityType: 'USER',
      entityId: user.id,
      entityName: user.email,
      metadata: {
        title: input.title,
        message: input.message,
        actionUrl: input.actionUrl ?? null,
      },
    });

    return notification;
  }

  async broadcastToAll(input: BroadcastInput, auditContext: AdminAuditContext) {
    const where: any = {
      deletedAt: null,
      isActive: true,
    };
    if (input.audience === BroadcastAudience.ADMIN) {
      where.role = 'ADMIN';
    } else if (input.audience === BroadcastAudience.USER) {
      where.role = 'USER';
    }

    const recipients = (await this.prisma.user.findMany({
      where,
      select: { id: true },
    })) as Array<{ id: string }>;

    await Promise.all(
      recipients.map((recipient) =>
        this.notificationsService.create({
          userId: recipient.id,
          type: 'SYSTEM',
          title: input.title,
          message: input.message,
          actionUrl: input.actionUrl ?? null,
        }),
      ),
    );

    await this.auditLogService.record({
      ...auditContext,
      action: 'SEND_BROADCAST_NOTIFICATION',
      entityType: 'NOTIFICATION',
      entityName: `Broadcast (${input.audience})`,
      metadata: {
        audience: input.audience,
        recipientCount: recipients.length,
        title: input.title,
        message: input.message,
        actionUrl: input.actionUrl ?? null,
      },
    });

    return {
      audience: input.audience,
      recipientCount: recipients.length,
    };
  }
}
