import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class ChallengesService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllSkills() {
    return this.prisma.skill.findMany({
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
      subdomain?: string[];
      skillLevel?: string[];
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

    if (filters?.subdomain?.length) {
      where.subdomain = { in: filters.subdomain };
    }

    if (filters?.skillLevel?.length) {
      where.skillLevel = { in: filters.skillLevel };
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
      subdomain: c.subdomain,
      skillLevel: c.skillLevel,
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
}
