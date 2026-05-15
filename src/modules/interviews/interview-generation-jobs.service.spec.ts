import { InterviewGenerationJobsService } from './interview-generation-jobs.service';

describe('InterviewGenerationJobsService', () => {
  const job = {
    id: 'job-1',
    userId: 'user-1',
    role: 'Frontend Developer',
    level: 'Junior',
    type: 'Technical',
    techstack: ['React', 'TypeScript'],
    amount: 5,
    language: 'en',
    provider: 'local-qwen',
    status: 'PENDING',
    interviewId: null,
    errorMessage: null,
    createdAt: new Date('2026-05-16T00:00:00.000Z'),
    updatedAt: new Date('2026-05-16T00:00:00.000Z'),
    completedAt: null,
  };

  const createPrismaMock = () => ({
    interviewGenerationJob: {
      findUnique: jest.fn().mockResolvedValue(job),
      update: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    interview: {
      create: jest.fn().mockResolvedValue({
        id: 'interview-1',
      }),
    },
  });

  const createAiMock = () => ({
    generateInterviewQuestions: jest
      .fn()
      .mockResolvedValue(['What is React?', 'Explain TypeScript.']),
  });

  const createNotificationsMock = () => ({
    create: jest.fn().mockResolvedValue({ id: 'notification-1' }),
    emitRealtime: jest.fn(),
  });

  it('emits a realtime processing notification when interview generation starts', async () => {
    const prisma = createPrismaMock();
    prisma.interviewGenerationJob.update
      .mockResolvedValueOnce({ ...job, status: 'PROCESSING' })
      .mockResolvedValueOnce({
        ...job,
        status: 'COMPLETED',
        interviewId: 'interview-1',
        completedAt: new Date('2026-05-16T00:05:00.000Z'),
      });
    const notifications = createNotificationsMock();
    const service = new InterviewGenerationJobsService(
      prisma as any,
      createAiMock() as any,
      notifications as any,
    );

    await (service as any).processJob(job.id);

    expect(notifications.emitRealtime).toHaveBeenCalledWith(job.userId, {
      id: `interview-generation-processing-${job.id}`,
      type: 'INTERVIEW_GENERATION_PROCESSING',
      title: 'Preparing your interview',
      message:
        'Frontend Developer Technical is being generated. You can keep using PrepWise while we build it.',
      metadata: {
        jobId: job.id,
        role: job.role,
        level: job.level,
        type: job.type,
      },
    });
  });

  it('creates a notification when interview generation completes', async () => {
    const prisma = createPrismaMock();
    prisma.interviewGenerationJob.update
      .mockResolvedValueOnce({ ...job, status: 'PROCESSING' })
      .mockResolvedValueOnce({
        ...job,
        status: 'COMPLETED',
        interviewId: 'interview-1',
        completedAt: new Date('2026-05-16T00:05:00.000Z'),
      });
    const notifications = createNotificationsMock();
    const service = new InterviewGenerationJobsService(
      prisma as any,
      createAiMock() as any,
      notifications as any,
    );

    await (service as any).processJob(job.id);

    expect(notifications.create).toHaveBeenCalledWith({
      userId: job.userId,
      type: 'INTERVIEW_GENERATION_COMPLETED',
      title: 'Interview ready',
      message:
        'Your Frontend Developer mock interview is ready with 5 questions.',
      actionUrl: '/interview/interview-1',
      metadata: {
        jobId: job.id,
        interviewId: 'interview-1',
        role: job.role,
        level: job.level,
        type: job.type,
      },
    });
  });

  it('creates a notification when interview generation fails', async () => {
    const prisma = createPrismaMock();
    prisma.interviewGenerationJob.update
      .mockResolvedValueOnce({ ...job, status: 'PROCESSING' })
      .mockResolvedValueOnce({
        ...job,
        status: 'FAILED',
        errorMessage: 'Model unavailable',
        completedAt: new Date('2026-05-16T00:05:00.000Z'),
      });
    const ai = createAiMock();
    ai.generateInterviewQuestions.mockRejectedValueOnce(
      new Error('Model unavailable'),
    );
    const notifications = createNotificationsMock();
    const service = new InterviewGenerationJobsService(
      prisma as any,
      ai as any,
      notifications as any,
    );

    await (service as any).processJob(job.id);

    expect(notifications.create).toHaveBeenCalledWith({
      userId: job.userId,
      type: 'INTERVIEW_GENERATION_FAILED',
      title: 'Interview generation failed',
      message: 'Model unavailable',
      actionUrl: '/interview/setup',
      metadata: {
        jobId: job.id,
        role: job.role,
        level: job.level,
        type: job.type,
      },
    });
  });
});
