import { BadRequestException } from '@nestjs/common';
import { FeedbacksService } from './feedbacks.service';

describe('FeedbacksService', () => {
  const userId = 'user-1';
  const attemptId = 'attempt-1';
  const interviewId = 'interview-1';

  const createMocks = () => {
    const prisma = {
      feedback: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      categoryScore: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      interviewAttempt: {
        update: jest.fn(),
      },
    };
    const aiService = {
      generateFeedback: jest.fn(),
    };
    const interviewsService = {
      findAttemptById: jest.fn().mockResolvedValue({
        interview: {
          id: interviewId,
          language: 'en',
        },
      }),
      saveTranscripts: jest.fn().mockResolvedValue({ count: 0 }),
    };

    return {
      prisma,
      aiService,
      interviewsService,
      service: new FeedbacksService(
        prisma as any,
        aiService as any,
        interviewsService as any,
      ),
    };
  };

  it('marks the attempt too short and skips AI feedback when user answers are insufficient', async () => {
    const { service, prisma, aiService, interviewsService } = createMocks();
    const transcript = [
      { role: 'assistant', content: 'Tell me about React state.' },
      { role: 'user', content: 'It stores data.' },
      { role: 'assistant', content: 'Can you explain props?' },
    ];

    await expect(
      service.create(userId, {
        attemptId,
        transcript,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(interviewsService.saveTranscripts).toHaveBeenCalledWith(
      attemptId,
      transcript,
    );
    expect(prisma.interviewAttempt.update).toHaveBeenCalledWith({
      where: { id: attemptId },
      data: {
        status: 'TOO_SHORT',
        endedAt: expect.any(Date),
        failureReason: expect.stringContaining('at least 2 answers'),
      },
    });
    expect(aiService.generateFeedback).not.toHaveBeenCalled();
    expect(prisma.feedback.create).not.toHaveBeenCalled();
    expect(prisma.feedback.update).not.toHaveBeenCalled();
  });

  it('generates feedback and marks the attempt completed for meaningful transcripts', async () => {
    const { service, prisma, aiService, interviewsService } = createMocks();
    const transcript = [
      { role: 'assistant', content: 'Tell me about React state.' },
      {
        role: 'user',
        content:
          'State is local component data that can change over time and trigger re-rendering.',
      },
      { role: 'assistant', content: 'How is it different from props?' },
      {
        role: 'user',
        content:
          'Props are passed from a parent component while state is owned and updated by the component itself.',
      },
    ];

    prisma.feedback.findUnique.mockResolvedValue(null);
    aiService.generateFeedback.mockResolvedValue({
      totalScore: 82,
      strengths: ['Clear fundamentals'],
      areasForImprovement: ['Add deeper examples'],
      finalAssessment: 'Solid junior-level answer.',
      categoryScores: [{ name: 'Technical', score: 82, comment: 'Good' }],
    });
    prisma.feedback.create.mockResolvedValue({ id: 'feedback-1' });
    prisma.feedback.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'feedback-1',
        categoryScores: [],
      });

    await service.create(userId, {
      attemptId,
      transcript,
    });

    expect(interviewsService.saveTranscripts).toHaveBeenCalledWith(
      attemptId,
      transcript,
    );
    expect(aiService.generateFeedback).toHaveBeenCalledWith(transcript, 'en');
    expect(prisma.interviewAttempt.update).toHaveBeenCalledWith({
      where: { id: attemptId },
      data: {
        status: 'COMPLETED',
        endedAt: expect.any(Date),
        completedAt: expect.any(Date),
        failureReason: null,
      },
    });
  });

  it('normalizes noisy voice transcript fragments before saving and generating feedback', async () => {
    const { service, prisma, aiService, interviewsService } = createMocks();
    const transcript = [
      { role: 'assistant', content: 'Hello.' },
      { role: 'assistant', content: 'Tell me about asynchronous JavaScript.' },
      { role: 'user', content: 'And' },
      {
        role: 'user',
        content:
          'Asynchronous JavaScript lets the app keep running while waiting for long operations.',
      },
      { role: 'assistant', content: 'Great.' },
      { role: 'assistant', content: 'Can you give an example?' },
      { role: 'user', content: 'Information.' },
      {
        role: 'user',
        content:
          'For example, a promise or async await can wait for an API request without blocking rendering.',
      },
    ];
    const normalizedTranscript = [
      {
        role: 'assistant',
        content: 'Tell me about asynchronous JavaScript.',
      },
      {
        role: 'user',
        content:
          'Asynchronous JavaScript lets the app keep running while waiting for long operations.',
      },
      { role: 'assistant', content: 'Can you give an example?' },
      {
        role: 'user',
        content:
          'For example, a promise or async await can wait for an API request without blocking rendering.',
      },
    ];

    prisma.feedback.findUnique.mockResolvedValue(null);
    aiService.generateFeedback.mockResolvedValue({
      totalScore: 80,
      strengths: ['Understands async basics'],
      areasForImprovement: ['Add event loop details'],
      finalAssessment: 'The candidate gave a usable explanation.',
      categoryScores: [{ name: 'Technical', score: 80, comment: 'Good' }],
    });
    prisma.feedback.create.mockResolvedValue({ id: 'feedback-1' });
    prisma.feedback.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'feedback-1',
        categoryScores: [],
      });

    await service.create(userId, {
      attemptId,
      transcript,
    });

    expect(interviewsService.saveTranscripts).toHaveBeenCalledWith(
      attemptId,
      normalizedTranscript,
    );
    expect(aiService.generateFeedback).toHaveBeenCalledWith(
      normalizedTranscript,
      'en',
    );
  });
});
