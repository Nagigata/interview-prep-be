import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class ChallengesService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllSkills() {
    return this.prisma.skill.findMany({
      where: { slug: { not: 'algorithms' } },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { challenges: true },
        },
      },
    });
  }

  async getChallengesBySkill(
    skillSlug: string,
    userId?: string,
    filters?: {
      difficulty?: string[];
      topics?: string[];
      status?: string[];
    },
  ) {
    const skill = await this.prisma.skill.findUnique({
      where: { slug: skillSlug },
    });

    if (!skill) {
      throw new NotFoundException('Skill not found');
    }

    const where: any = {
      skillId: skill.id,
    };

    if (filters?.difficulty?.length) {
      where.difficulty = { in: filters.difficulty };
    }

    if (filters?.topics?.length) {
      // Topics are stored as comma-separated string so we use OR contains
      where.OR = filters.topics.map((topic) => ({
        topics: { contains: topic, mode: 'insensitive' },
      }));
    }



    // Handled Solved/Unsolved filters later in JS/separate query if needed,
    // but for now let's fetch matching challenges and then filter by status if provided.

    const include: any = {};
    if (userId) {
      include.submissions = {
        where: { userId, status: 'ACCEPTED' },
        take: 1,
      };
      include.stars = {
        where: { userId },
        take: 1,
      };
    }

    const challenges = await this.prisma.challenge.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: Object.keys(include).length > 0 ? include : undefined,
    });

    let resultChallenges = challenges.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      difficulty: c.difficulty,
      topics: c.topics,
      isSolved: (c as any).submissions?.length > 0,
      isStarred: (c as any).stars?.length > 0,
    }));

    // Filter by Status if provided
    if (filters?.status?.length) {
      const statusFilters = filters.status.map((s) => s.toUpperCase());
      const hasSolved = statusFilters.includes('SOLVED');
      const hasUnsolved = statusFilters.includes('UNSOLVED');

      if (!(hasSolved && hasUnsolved)) {
        resultChallenges = resultChallenges.filter((c) => {
          if (hasSolved) return c.isSolved;
          if (hasUnsolved) return !c.isSolved;
          return true;
        });
      }
    }

    return {
      ...skill,
      challenges: resultChallenges,
    };
  }

  async toggleChallengeStar(userId: string, challengeId: string) {
    const existingStar = await this.prisma.challengeStar.findUnique({
      where: {
        userId_challengeId: {
          userId,
          challengeId,
        },
      },
    });

    if (existingStar) {
      await this.prisma.challengeStar.delete({
        where: { id: existingStar.id },
      });
      return { starred: false };
    } else {
      await this.prisma.challengeStar.create({
        data: {
          userId,
          challengeId,
        },
      });
      return { starred: true };
    }
  }

  async getChallengeById(id: string) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id },
      include: {
        skill: true,
      },
    });

    if (!challenge) {
      throw new NotFoundException('Challenge not found');
    }

    return challenge;
  }

  async getAllChallenges(
    userId?: string,
    filters?: {
      difficulty?: string[];
      topics?: string[];
      status?: string[];
      skillSlug?: string;
      page?: number;
      limit?: number;
      search?: string;
    },
  ) {
    const where: any = {};

    if (filters?.search) {
      where.title = { contains: filters.search, mode: 'insensitive' };
    }

    if (filters?.difficulty?.length) {
      where.difficulty = { in: filters.difficulty };
    }

    if (filters?.topics?.length) {
      // Topics are stored as comma-separated string so we use OR contains
      where.OR = filters.topics.map((topic) => ({
        topics: { contains: topic, mode: 'insensitive' },
      }));
    }



    const targetSkillSlug = filters?.skillSlug || 'algorithms';
    const skill = await this.prisma.skill.findUnique({
      where: { slug: targetSkillSlug },
    });
    if (skill) {
      where.skillId = skill.id;
    }

    if (filters?.status?.length) {
      const statusFilters = filters.status.map((s) => s.toUpperCase());
      const hasSolved = statusFilters.includes('SOLVED');
      const hasUnsolved = statusFilters.includes('UNSOLVED');

      if (hasSolved && !hasUnsolved) {
        where.submissions = { some: { userId, status: 'ACCEPTED' } };
      } else if (!hasSolved && hasUnsolved) {
        where.submissions = { none: { userId, status: 'ACCEPTED' } };
      }
    }

    const include: any = {};
    if (userId) {
      include.submissions = {
        where: { userId, status: 'ACCEPTED' },
        take: 1,
      };
      include.stars = {
        where: { userId },
        take: 1,
      };
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 100;
    const skip = (page - 1) * limit;

    const [challenges, total] = await Promise.all([
      this.prisma.challenge.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        include: Object.keys(include).length > 0 ? include : undefined,
      }),
      this.prisma.challenge.count({ where }),
    ]);

    let resultChallenges = challenges.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      difficulty: c.difficulty,
      topics: c.topics,
      skillSlug: (c as any).skill?.slug,
      isSolved: (c as any).submissions?.length > 0,
      isStarred: (c as any).stars?.length > 0,
    }));

    return { data: resultChallenges, total };
  }

  async getUniqueTopics() {
    const records = await this.prisma.challenge.findMany({
      where: {
        skill: { slug: 'algorithms' }
      },
      select: { topics: true },
    });

    const topicSet = new Set<string>();
    records.forEach(r => {
      if (r.topics) {
        r.topics.split(',').forEach(t => {
          const trimmed = t.trim();
          if (trimmed) topicSet.add(trimmed);
        });
      }
    });

    return Array.from(topicSet).sort();
  }
}
