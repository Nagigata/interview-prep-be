import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const userId = 'user-1';
  const notification = {
    id: 'notification-1',
    userId,
    type: 'INTERVIEW_GENERATION_COMPLETED',
    title: 'Interview ready',
    message: 'Your interview is ready.',
    actionUrl: '/interview/interview-1',
    metadata: { interviewId: 'interview-1' },
    readAt: null,
    createdAt: new Date('2026-05-16T00:00:00.000Z'),
  };

  const createPrismaMock = () => ({
    notification: {
      create: jest.fn().mockResolvedValue(notification),
      findMany: jest.fn().mockResolvedValue([notification]),
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn().mockResolvedValue(notification),
      update: jest.fn().mockResolvedValue({
        ...notification,
        readAt: new Date('2026-05-16T01:00:00.000Z'),
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
  });

  const createGatewayMock = () => ({
    emitNotificationCreated: jest.fn(),
    emitNotificationsRead: jest.fn(),
  });

  it('creates a notification and emits it to the target user room', async () => {
    const prisma = createPrismaMock();
    const gateway = createGatewayMock();
    const service = new NotificationsService(prisma as any, gateway as any);

    const result = await service.create({
      userId,
      type: 'INTERVIEW_GENERATION_COMPLETED',
      title: 'Interview ready',
      message: 'Your interview is ready.',
      actionUrl: '/interview/interview-1',
      metadata: { interviewId: 'interview-1' },
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId,
        type: 'INTERVIEW_GENERATION_COMPLETED',
        title: 'Interview ready',
        message: 'Your interview is ready.',
        actionUrl: '/interview/interview-1',
        metadata: { interviewId: 'interview-1' },
      },
    });
    expect(gateway.emitNotificationCreated).toHaveBeenCalledWith(
      userId,
      result,
    );
  });

  it('lists notifications for the current user with unread count metadata', async () => {
    const prisma = createPrismaMock();
    const service = new NotificationsService(
      prisma as any,
      createGatewayMock() as any,
    );

    const result = await service.findMine(userId, { page: 2, limit: 5 });

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: 5,
      take: 5,
    });
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { userId },
    });
    expect(result).toEqual({
      items: [notification],
      total: 1,
      unreadCount: 1,
      page: 2,
      limit: 5,
      totalPages: 1,
    });
  });

  it('marks only the current user notification as read', async () => {
    const prisma = createPrismaMock();
    const gateway = createGatewayMock();
    const service = new NotificationsService(prisma as any, gateway as any);

    const result = await service.markAsRead(userId, notification.id);

    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: { id: notification.id, userId },
    });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: notification.id },
      data: { readAt: expect.any(Date) },
    });
    expect(gateway.emitNotificationsRead).toHaveBeenCalledWith(userId, {
      ids: [notification.id],
    });
    expect(result.readAt).toEqual(expect.any(Date));
  });

  it('throws when marking another user notification as read', async () => {
    const prisma = createPrismaMock();
    prisma.notification.findFirst.mockResolvedValue(null);
    const service = new NotificationsService(
      prisma as any,
      createGatewayMock() as any,
    );

    await expect(service.markAsRead(userId, notification.id)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('marks all unread notifications for the current user as read', async () => {
    const prisma = createPrismaMock();
    const gateway = createGatewayMock();
    const service = new NotificationsService(prisma as any, gateway as any);

    const result = await service.markAllAsRead(userId);

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId, readAt: null },
      data: { readAt: expect.any(Date) },
    });
    expect(gateway.emitNotificationsRead).toHaveBeenCalledWith(userId, {
      all: true,
    });
    expect(result).toEqual({ count: 2 });
  });
});
