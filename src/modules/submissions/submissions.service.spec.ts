import { NotFoundException } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';

describe('SubmissionsService', () => {
  const userId = 'user-1';
  const challengeId = 'challenge-1';
  const submissionId = 'submission-1';

  const submission = {
    id: submissionId,
    challengeId,
    userId,
    language: 'typescript',
    status: 'ACCEPTED',
    runtime: 42,
    memory: 1024,
    passedTestCases: 63,
    totalTestCases: 63,
    errorMessage: null,
    note: 'Remember hash map edge cases.',
    noteColor: 'blue',
    createdAt: new Date('2026-05-16T00:00:00.000Z'),
  };

  const createPrismaMock = () => ({
    challenge: {
      findFirst: jest.fn().mockResolvedValue({
        id: challengeId,
        testCases: [
          { input: '2 7', output: '0 1' },
          { input: '3 2 4', output: '1 2' },
          { input: '3 3', output: '0 1' },
        ],
      }),
    },
    challengeSubmission: {
      findMany: jest.fn().mockImplementation((args) => {
        if (args?.distinct?.includes('language')) {
          return Promise.resolve([
            { language: 'typescript' },
            { language: 'python' },
          ]);
        }
        if (args?.distinct?.includes('status')) {
          return Promise.resolve([{ status: 'ACCEPTED' }, { status: 'REJECTED' }]);
        }
        return Promise.resolve([submission]);
      }),
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn().mockResolvedValue(submission),
      create: jest.fn().mockResolvedValue(submission),
      update: jest
        .fn()
        .mockResolvedValue({ ...submission, note: 'Updated', noteColor: 'green' }),
    },
  });

  it('returns paginated challenge submission history for the current user only', async () => {
    const prisma = createPrismaMock();
    const service = new SubmissionsService({} as any, prisma as any);

    const result = await service.getChallengeSubmissionHistory(
      challengeId,
      userId,
      { page: 2, limit: 5 },
    );

    expect(prisma.challengeSubmission.findMany).toHaveBeenNthCalledWith(1, {
      where: { challengeId, userId },
      orderBy: { createdAt: 'desc' },
      skip: 5,
      take: 5,
      select: {
        id: true,
        language: true,
        status: true,
        runtime: true,
        memory: true,
        passedTestCases: true,
        totalTestCases: true,
        errorMessage: true,
        note: true,
        noteColor: true,
        createdAt: true,
      },
    });
    expect(prisma.challengeSubmission.count).toHaveBeenCalledWith({
      where: { challengeId, userId },
    });
    expect(result).toEqual({
      items: [submission],
      page: 2,
      limit: 5,
      total: 1,
      totalPages: 1,
      filters: {
        statuses: ['ACCEPTED', 'REJECTED'],
        languages: ['typescript', 'python'],
      },
    });
  });

  it('applies status and language filters to challenge submission history', async () => {
    const prisma = createPrismaMock();
    const service = new SubmissionsService({} as any, prisma as any);

    await service.getChallengeSubmissionHistory(challengeId, userId, {
      status: 'accepted',
      language: 'TypeScript',
    });

    expect(prisma.challengeSubmission.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          challengeId,
          userId,
          status: 'ACCEPTED',
          language: 'typescript',
        },
      }),
    );
    expect(prisma.challengeSubmission.count).toHaveBeenCalledWith({
      where: {
        challengeId,
        userId,
        status: 'ACCEPTED',
        language: 'typescript',
      },
    });
  });

  it('returns submission detail with code only when it belongs to the current user', async () => {
    const prisma = createPrismaMock();
    const service = new SubmissionsService({} as any, prisma as any);

    const result = await service.getSubmissionDetail(submissionId, userId);

    expect(prisma.challengeSubmission.findFirst).toHaveBeenCalledWith({
      where: { id: submissionId, userId },
      select: {
        id: true,
        challengeId: true,
        language: true,
        status: true,
        runtime: true,
        memory: true,
        passedTestCases: true,
        totalTestCases: true,
        errorMessage: true,
        note: true,
        noteColor: true,
        code: true,
        createdAt: true,
      },
    });
    expect(result).toEqual(submission);
  });

  it('stores passed and total test case counts when submitting code', async () => {
    const prisma = createPrismaMock();
    const service = new SubmissionsService({} as any, prisma as any);
    const executeInJudge0 = jest
      .fn()
      .mockResolvedValueOnce({ status: { id: 3 }, time: '0.001', memory: 128 })
      .mockResolvedValueOnce({ status: { id: 4 }, time: '0.002', memory: 256 })
      .mockResolvedValueOnce({ status: { id: 3 }, time: '0.003', memory: 512 });
    (service as any).executeInJudge0 = executeInJudge0;

    const result = await service.submitCode(
      challengeId,
      userId,
      'return nums;',
      'javascript',
    );

    expect(executeInJudge0).toHaveBeenCalledTimes(3);
    expect(prisma.challengeSubmission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        challengeId,
        userId,
        code: 'return nums;',
        language: 'javascript',
        status: 'REJECTED',
        passedTestCases: 2,
        totalTestCases: 3,
      }),
    });
    expect(result).toEqual(
      expect.objectContaining({
        submissionId,
        allPassed: false,
        passedTestCases: 2,
        totalTestCases: 3,
      }),
    );
  });

  it('throws when viewing another user submission detail', async () => {
    const prisma = createPrismaMock();
    prisma.challengeSubmission.findFirst.mockResolvedValue(null);
    const service = new SubmissionsService({} as any, prisma as any);

    await expect(
      service.getSubmissionDetail(submissionId, userId),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates a submission note only when it belongs to the current user', async () => {
    const prisma = createPrismaMock();
    const service = new SubmissionsService({} as any, prisma as any);

    const result = await service.updateSubmissionNote(
      submissionId,
      userId,
      '  Updated  ',
      'green',
    );

    expect(prisma.challengeSubmission.findFirst).toHaveBeenCalledWith({
      where: { id: submissionId, userId },
      select: { id: true },
    });
    expect(prisma.challengeSubmission.update).toHaveBeenCalledWith({
      where: { id: submissionId },
      data: { note: 'Updated', noteColor: 'green' },
      select: {
        id: true,
        note: true,
        noteColor: true,
      },
    });
    expect(result.note).toBe('Updated');
    expect(result.noteColor).toBe('green');
  });

  it('clears a submission note when the note is blank', async () => {
    const prisma = createPrismaMock();
    const service = new SubmissionsService({} as any, prisma as any);

    await service.updateSubmissionNote(submissionId, userId, '   ');

    expect(prisma.challengeSubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { note: null, noteColor: null },
      }),
    );
  });

  it('falls back to gray for unsupported note colors', async () => {
    const prisma = createPrismaMock();
    const service = new SubmissionsService({} as any, prisma as any);

    await service.updateSubmissionNote(submissionId, userId, 'Updated', 'neon');

    expect(prisma.challengeSubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { note: 'Updated', noteColor: 'gray' },
      }),
    );
  });

  it('throws when updating another user submission note', async () => {
    const prisma = createPrismaMock();
    prisma.challengeSubmission.findFirst.mockResolvedValue(null);
    const service = new SubmissionsService({} as any, prisma as any);

    await expect(
      service.updateSubmissionNote(submissionId, userId, 'Updated'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.challengeSubmission.update).not.toHaveBeenCalled();
  });
});
