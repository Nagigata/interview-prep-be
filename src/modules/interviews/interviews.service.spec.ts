import { InterviewsService } from './interviews.service';

describe('InterviewsService', () => {
  const userId = 'user-1';
  const interviewId = 'interview-1';

  const createPrismaMock = () => ({
    interview: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    interviewStar: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  });

  it('marks interviews as starred when listing user interviews', async () => {
    const prisma = createPrismaMock();
    prisma.interview.findMany.mockResolvedValue([
      {
        id: interviewId,
        role: 'Frontend Developer',
        stars: [{ id: 'star-1' }],
      },
      {
        id: 'interview-2',
        role: 'Backend Developer',
        stars: [],
      },
    ]);
    const service = new InterviewsService(prisma as any);

    const result = await service.findByUserId(userId);

    expect(prisma.interview.findMany).toHaveBeenCalledWith({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        stars: {
          where: { userId },
          take: 1,
        },
      },
    });
    expect(result).toEqual([
      expect.objectContaining({ id: interviewId, isStarred: true }),
      expect.objectContaining({ id: 'interview-2', isStarred: false }),
    ]);
  });

  it('toggles interview star on and off for the current user', async () => {
    const prisma = createPrismaMock();
    prisma.interview.findUnique.mockResolvedValue({ id: interviewId });
    prisma.interviewStar.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'star-1' });
    const service = new InterviewsService(prisma as any);

    await expect(
      service.toggleInterviewStar(userId, interviewId),
    ).resolves.toEqual({
      starred: true,
    });
    expect(prisma.interviewStar.create).toHaveBeenCalledWith({
      data: { userId, interviewId },
    });

    await expect(
      service.toggleInterviewStar(userId, interviewId),
    ).resolves.toEqual({
      starred: false,
    });
    expect(prisma.interviewStar.delete).toHaveBeenCalledWith({
      where: { id: 'star-1' },
    });
  });
});
