import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';

type SkillWriteData = {
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  isActive?: boolean;
};

@Injectable()
export class AdminSkillsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeSkillData<T extends SkillWriteData>(data: T): T {
    return {
      ...data,
      ...(typeof data.name === 'string' ? { name: data.name.trim() } : {}),
      ...(typeof data.slug === 'string' ? { slug: data.slug.trim() } : {}),
    };
  }

  private async ensureSkillNameAndSlugAreUnique(
    data: SkillWriteData,
    currentSkillId?: string,
  ) {
    const name = typeof data.name === 'string' ? data.name.trim() : undefined;
    const slug = typeof data.slug === 'string' ? data.slug.trim() : undefined;

    if (data.name !== undefined && !name) {
      throw new BadRequestException('Skill name is required.');
    }

    if (data.slug !== undefined && !slug) {
      throw new BadRequestException('Skill slug is required.');
    }

    const duplicateFilters: Prisma.SkillWhereInput[] = [];

    if (name) {
      duplicateFilters.push({
        name: { equals: name, mode: 'insensitive' },
      });
    }

    if (slug) {
      duplicateFilters.push({
        slug: { equals: slug, mode: 'insensitive' },
      });
    }

    if (duplicateFilters.length === 0) return;

    const duplicatedSkills = await this.prisma.skill.findMany({
      where: {
        OR: duplicateFilters,
        ...(currentSkillId ? { id: { not: currentSkillId } } : {}),
      },
      select: { name: true, slug: true },
    });

    const normalizedName = name?.toLowerCase();
    const normalizedSlug = slug?.toLowerCase();

    if (
      normalizedName &&
      duplicatedSkills.some(
        (skill) => skill.name.trim().toLowerCase() === normalizedName,
      )
    ) {
      throw new BadRequestException('Skill name already exists.');
    }

    if (
      normalizedSlug &&
      duplicatedSkills.some(
        (skill) => skill.slug.trim().toLowerCase() === normalizedSlug,
      )
    ) {
      throw new BadRequestException('Skill slug already exists.');
    }
  }

  async getSkills() {
    return this.prisma.skill.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { challenges: true } },
      },
    });
  }

  async createSkill(data: SkillWriteData & { name: string; slug: string }) {
    const normalizedData = this.normalizeSkillData(data);

    await this.ensureSkillNameAndSlugAreUnique(normalizedData);

    return this.prisma.skill.create({ data: normalizedData });
  }

  async updateSkill(skillId: string, data: SkillWriteData) {
    const normalizedData = this.normalizeSkillData(data);

    await this.ensureSkillNameAndSlugAreUnique(normalizedData, skillId);

    return this.prisma.skill.update({
      where: { id: skillId },
      data: normalizedData,
    });
  }

  async deleteSkill(skillId: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { id: skillId },
    });

    if (!skill) {
      throw new BadRequestException('Skill not found.');
    }

    return this.prisma.skill.update({
      where: { id: skillId },
      data: { isActive: false },
    });
  }
}
