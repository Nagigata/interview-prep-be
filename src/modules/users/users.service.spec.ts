import { UsersService } from './users.service';

describe('UsersService', () => {
  const userId = 'user-1';

  const createPrismaMock = () => ({
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: userId,
        name: 'Test User',
        email: 'test@example.com',
        role: 'USER',
        isActive: true,
        avatarUrl: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    },
    challengeStar: {
      count: jest.fn().mockResolvedValue(0),
    },
    interviewStar: {
      findMany: jest.fn().mockResolvedValue([
        {
          createdAt: new Date('2026-05-13T10:00:00.000Z'),
          interview: {
            id: 'interview-starred-1',
            role: 'Backend Developer',
            level: 'Mid-level',
            questions: ['What is dependency injection?'],
            techstack: ['Java', 'Spring Boot'],
            createdAt: new Date('2026-05-10T00:00:00.000Z'),
            userId,
            type: 'Technical',
            language: 'en',
            finalized: true,
            _count: {
              attempts: 2,
            },
            feedbacks: [
              {
                id: 'feedback-1',
                totalScore: 88,
              },
            ],
          },
        },
      ]),
      count: jest.fn().mockResolvedValue(1),
    },
    interview: {
      count: jest.fn().mockResolvedValue(1),
    },
    challengeSubmission: {
      count: jest.fn().mockResolvedValue(1),
      groupBy: jest.fn().mockResolvedValue([{ challengeId: 'challenge-1' }]),
      findMany: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'submission-1',
            challengeId: 'challenge-1',
            createdAt: new Date('2026-05-12T08:00:00.000Z'),
            challenge: {
              id: 'challenge-1',
              difficulty: 'EASY',
            },
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'submission-1',
            challengeId: 'challenge-1',
            language: 'typescript',
            status: 'ACCEPTED',
            runtime: 42,
            memory: 1024,
            createdAt: new Date('2026-05-12T08:00:00.000Z'),
            challenge: {
              id: 'challenge-1',
              title: 'Two Sum',
              difficulty: 'EASY',
              skill: { slug: 'algorithms' },
            },
          },
        ])
        .mockResolvedValueOnce([
          {
            createdAt: new Date('2026-05-12T08:00:00.000Z'),
          },
        ]),
    },
    challenge: {
      groupBy: jest.fn().mockResolvedValue([
        { difficulty: 'EASY', _count: { _all: 10 } },
        { difficulty: 'MEDIUM', _count: { _all: 5 } },
        { difficulty: 'HARD', _count: { _all: 2 } },
      ]),
    },
    interviewAttempt: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'attempt-1',
            completedAt: new Date('2026-05-13T09:00:00.000Z'),
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'attempt-1',
            interviewId: 'interview-1',
            completedAt: new Date('2026-05-13T09:00:00.000Z'),
            interview: {
              role: 'Frontend Developer',
              level: 'Junior',
              type: 'Technical',
            },
            feedback: {
              totalScore: 86,
            },
          },
        ]),
      count: jest.fn().mockResolvedValue(1),
    },
  });

  it('counts completed interview attempts as profile activity and recent activity', async () => {
    const prisma = createPrismaMock();
    const service = new UsersService(prisma as any);

    const result = await service.findById(userId, 'UTC');

    expect(prisma.interviewAttempt.findMany).toHaveBeenCalledWith({
      where: {
        userId,
        status: 'COMPLETED',
        completedAt: {
          gte: expect.any(Date),
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
    });
    expect(result.stats.activeDays).toBeGreaterThanOrEqual(2);
    expect(result.activityCalendar).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: '2026-05-12', count: 1 }),
        expect.objectContaining({ date: '2026-05-13', count: 1 }),
      ]),
    );
    expect(result.recentActivity[0]).toEqual(
      expect.objectContaining({
        id: 'attempt-1',
        activityType: 'INTERVIEW_ATTEMPT',
        interviewId: 'interview-1',
        interviewRole: 'Frontend Developer',
        status: 'COMPLETED',
        score: 86,
      }),
    );
  });

  it('returns starred interviews with card metadata', async () => {
    const prisma = createPrismaMock();
    const service = new UsersService(prisma as any);

    const result = await service.getStarredInterviews(userId, {
      page: 1,
      limit: 10,
    });

    expect(prisma.interviewStar.findMany).toHaveBeenCalledWith({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 10,
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
    });
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'interview-starred-1',
        role: 'Backend Developer',
        isStarred: true,
        attemptCount: 2,
        feedback: expect.objectContaining({ totalScore: 88 }),
      }),
    );
    expect(result.total).toBe(1);
  });

  it('filters starred interviews through the database query', async () => {
    const prisma = createPrismaMock();
    const service = new UsersService(prisma as any);

    await service.getStarredInterviews(userId, {
      page: 1,
      limit: 10,
      type: ['Mix'],
      level: ['Senior'],
    });

    expect(prisma.interviewStar.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId,
          interview: {
            OR: [
              {
                type: {
                  contains: 'Mix',
                  mode: 'insensitive',
                },
              },
            ],
            level: {
              in: ['Senior'],
            },
          },
        },
      }),
    );
    expect(prisma.interviewStar.count).toHaveBeenCalledWith({
      where: {
        userId,
        interview: {
          OR: [
            {
              type: {
                contains: 'Mix',
                mode: 'insensitive',
              },
            },
          ],
          level: {
            in: ['Senior'],
          },
        },
      },
    });
  });

  it('filters practice history to completed interview attempts with summary counts', async () => {
    const prisma = {
      challengeSubmission: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn(),
      },
      interviewAttempt: {
        count: jest.fn().mockResolvedValue(3),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'attempt-2',
            interviewId: 'interview-2',
            completedAt: new Date('2026-05-14T08:00:00.000Z'),
            interview: {
              role: 'Backend Developer',
              level: 'Senior',
              type: 'Technical',
            },
            feedback: {
              totalScore: 91,
            },
          },
        ]),
      },
    };
    const service = new UsersService(prisma as any);

    const result = await service.getRecentActivity(userId, {
      page: 1,
      limit: 10,
      activityType: 'interviews',
    });

    expect(prisma.challengeSubmission.findMany).not.toHaveBeenCalled();
    expect(prisma.interviewAttempt.findMany).toHaveBeenCalledWith({
      where: {
        userId,
        status: 'COMPLETED',
        completedAt: {
          not: null,
        },
        feedback: {
          isNot: null,
        },
      },
      orderBy: { completedAt: 'desc' },
      skip: 0,
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
    });
    expect(result.total).toBe(3);
    expect(result.summary).toEqual({
      total: 5,
      challengeSubmissions: 2,
      interviewAttempts: 3,
    });
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        activityType: 'INTERVIEW_ATTEMPT',
        interviewRole: 'Backend Developer',
        score: 91,
      }),
    );
  });
});
