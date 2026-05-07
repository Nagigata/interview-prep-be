import { BadRequestException, Injectable } from '@nestjs/common';
import { Difficulty, Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';

type ChallengeWriteData = {
  skillId?: string;
  title?: string;
  slug?: string;
};

@Injectable()
export class AdminChallengesService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureChallengeTitleAndSlugAreUnique(
    data: ChallengeWriteData,
    currentChallengeId?: string,
  ) {
    const existingChallenge = currentChallengeId
      ? await this.prisma.challenge.findUnique({
          where: { id: currentChallengeId },
          select: { skillId: true, title: true, slug: true },
        })
      : null;

    if (currentChallengeId && !existingChallenge) {
      throw new BadRequestException('Challenge not found.');
    }

    const title =
      typeof data.title === 'string'
        ? data.title.trim()
        : existingChallenge?.title;
    const skillId = data.skillId ?? existingChallenge?.skillId;
    const slug =
      typeof data.slug === 'string' ? data.slug.trim() : data.slug;

    if (data.title !== undefined && !title) {
      throw new BadRequestException('Challenge title is required.');
    }

    if (data.slug !== undefined && !slug) {
      throw new BadRequestException('Challenge slug is required.');
    }

    const duplicateFilters: Prisma.ChallengeWhereInput[] = [];

    if (title && skillId) {
      duplicateFilters.push({
        title: { equals: title, mode: 'insensitive' },
        skillId,
      });
    }

    if (slug) {
      duplicateFilters.push({
        slug: { equals: slug, mode: 'insensitive' },
      });
    }

    if (duplicateFilters.length === 0) return;

    const duplicatedChallenges = await this.prisma.challenge.findMany({
      where: {
        OR: duplicateFilters,
        ...(currentChallengeId ? { id: { not: currentChallengeId } } : {}),
      },
      select: { title: true, slug: true, skillId: true },
    });

    const normalizedTitle = title?.toLowerCase();
    const normalizedSlug = slug?.toLowerCase();

    if (
      normalizedTitle &&
      skillId &&
      duplicatedChallenges.some(
        (challenge) =>
          challenge.skillId === skillId &&
          challenge.title.trim().toLowerCase() === normalizedTitle,
      )
    ) {
      throw new BadRequestException(
        'Challenge title already exists in this skill.',
      );
    }

    if (
      normalizedSlug &&
      duplicatedChallenges.some(
        (challenge) => challenge.slug.trim().toLowerCase() === normalizedSlug,
      )
    ) {
      throw new BadRequestException('Challenge slug already exists.');
    }
  }

  async getChallenges(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { topics: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.challenge.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          skillId: true,
          title: true,
          slug: true,
          description: true,
          difficulty: true,
          topics: true,
          isActive: true,
          examples: true,
          constraints: true,
          hints: true,
          solution: true,
          followUps: true,
          templateCode: true,
          testCases: true,
          createdAt: true,
          skill: { select: { id: true, name: true, slug: true } },
          _count: { select: { submissions: true } },
        },
      }),
      this.prisma.challenge.count({ where }),
    ]);

    return {
      items: items.map((challenge) => ({
        ...challenge,
        totalSubmissions: challenge._count.submissions,
        _count: undefined,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async createChallenge(data: {
    skillId: string;
    title: string;
    slug: string;
    description: string;
    difficulty: string;
    topics?: string;
    templateCode: any;
    testCases: any;
    examples?: any;
    constraints?: any;
    hints?: any;
    solution?: string;
    followUps?: any;
  }) {
    const title = data.title.trim();
    const slug = data.slug.trim();

    await this.ensureChallengeTitleAndSlugAreUnique({
      skillId: data.skillId,
      title,
      slug,
    });

    return this.prisma.challenge.create({
      data: {
        skillId: data.skillId,
        title,
        slug,
        description: data.description,
        difficulty: data.difficulty as Difficulty,
        topics: data.topics || '',
        templateCode: data.templateCode,
        testCases: data.testCases,
        examples: data.examples,
        constraints: data.constraints,
        hints: data.hints,
        solution: data.solution,
        followUps: data.followUps,
      },
    });
  }

  async updateChallenge(
    challengeId: string,
    data: {
      title?: string;
      slug?: string;
      skillId?: string;
      description?: string;
      difficulty?: string;
      topics?: string;
      templateCode?: any;
      testCases?: any;
      examples?: any;
      constraints?: any;
      hints?: any;
      solution?: string;
      followUps?: any;
      isActive?: boolean;
    },
  ) {
    await this.ensureChallengeTitleAndSlugAreUnique(
      {
        skillId: data.skillId,
        title: data.title,
        slug: data.slug,
      },
      challengeId,
    );

    const updateData: any = {};
    if (data.skillId !== undefined) updateData.skillId = data.skillId;
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.slug !== undefined) updateData.slug = data.slug.trim();
    if (data.description !== undefined) updateData.description = data.description;
    if (data.difficulty !== undefined) updateData.difficulty = data.difficulty;
    if (data.topics !== undefined) updateData.topics = data.topics;
    if (data.templateCode !== undefined) updateData.templateCode = data.templateCode;
    if (data.testCases !== undefined) updateData.testCases = data.testCases;
    if (data.examples !== undefined) updateData.examples = data.examples;
    if (data.constraints !== undefined) updateData.constraints = data.constraints;
    if (data.hints !== undefined) updateData.hints = data.hints;
    if (data.solution !== undefined) updateData.solution = data.solution;
    if (data.followUps !== undefined) updateData.followUps = data.followUps;
    if (typeof data.isActive === 'boolean') updateData.isActive = data.isActive;

    return this.prisma.challenge.update({
      where: { id: challengeId },
      data: updateData,
    });
  }

  async deleteChallenge(challengeId: string) {
    return this.prisma.challenge.update({
      where: { id: challengeId },
      data: { isActive: false },
    });
  }
}
