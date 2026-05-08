import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  AdminAuditContext,
  AdminAuditLogService,
} from './admin-audit-log.service';

type SkillWriteData = {
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  isActive?: boolean;
};

@Injectable()
export class AdminSkillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AdminAuditLogService,
  ) {}

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

  async getSkills(params?: { status?: string }) {
    const where: Prisma.SkillWhereInput = {};
    if (params?.status === 'active') {
      where.isActive = true;
    }
    if (params?.status === 'disabled') {
      where.isActive = false;
    }

    return this.prisma.skill.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { challenges: true } },
      },
    });
  }

  async createSkill(
    data: SkillWriteData & { name: string; slug: string },
    auditContext?: AdminAuditContext,
  ) {
    const normalizedData = this.normalizeSkillData(data);

    await this.ensureSkillNameAndSlugAreUnique(normalizedData);

    const skill = await this.prisma.skill.create({ data: normalizedData });

    if (auditContext) {
      await this.auditLogService.record({
        ...auditContext,
        action: 'CREATE_SKILL',
        entityType: 'SKILL',
        entityId: skill.id,
        entityName: skill.name,
        metadata: {
          after: {
            name: skill.name,
            slug: skill.slug,
            isActive: skill.isActive,
          },
        },
      });
    }

    return skill;
  }

  async updateSkill(
    skillId: string,
    data: SkillWriteData,
    auditContext?: AdminAuditContext,
  ) {
    const normalizedData = this.normalizeSkillData(data);

    await this.ensureSkillNameAndSlugAreUnique(normalizedData, skillId);

    const before = await this.prisma.skill.findUnique({
      where: { id: skillId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        icon: true,
        isActive: true,
      },
    });

    if (!before) {
      throw new BadRequestException('Skill not found.');
    }

    const skill = await this.prisma.skill.update({
      where: { id: skillId },
      data: normalizedData,
    });

    if (auditContext) {
      const isStatusChange = before.isActive !== skill.isActive;
      await this.auditLogService.record({
        ...auditContext,
        action: isStatusChange
          ? skill.isActive
            ? 'ENABLE_SKILL'
            : 'DISABLE_SKILL'
          : 'UPDATE_SKILL',
        entityType: 'SKILL',
        entityId: skill.id,
        entityName: skill.name,
        metadata: {
          before: {
            name: before.name,
            slug: before.slug,
            description: before.description,
            icon: before.icon,
            isActive: before.isActive,
          },
          after: {
            name: skill.name,
            slug: skill.slug,
            description: skill.description,
            icon: skill.icon,
            isActive: skill.isActive,
          },
        },
      });
    }

    return skill;
  }

  async deleteSkill(skillId: string, auditContext?: AdminAuditContext) {
    const skill = await this.prisma.skill.findUnique({
      where: { id: skillId },
    });

    if (!skill) {
      throw new BadRequestException('Skill not found.');
    }

    const updatedSkill = await this.prisma.skill.update({
      where: { id: skillId },
      data: { isActive: false },
    });

    if (auditContext && skill.isActive !== updatedSkill.isActive) {
      await this.auditLogService.record({
        ...auditContext,
        action: 'DISABLE_SKILL',
        entityType: 'SKILL',
        entityId: updatedSkill.id,
        entityName: updatedSkill.name,
        metadata: {
          before: { isActive: skill.isActive },
          after: { isActive: updatedSkill.isActive },
        },
      });
    }

    return updatedSkill;
  }
}
