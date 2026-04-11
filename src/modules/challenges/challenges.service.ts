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

  async getChallengesBySkill(skillSlug: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { slug: skillSlug },
      include: {
        challenges: {
          select: {
            id: true,
            title: true,
            slug: true,
            difficulty: true,
            tags: true,
          },
        },
      },
    });

    if (!skill) {
      throw new NotFoundException('Skill not found');
    }

    return skill;
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
