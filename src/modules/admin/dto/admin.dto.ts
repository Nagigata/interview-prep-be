import { IsString, IsNotEmpty, IsEnum, IsOptional, IsObject, IsArray } from 'class-validator';

export enum DifficultyEnum {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

export class CreateChallengeDto {
  @IsString()
  @IsNotEmpty()
  skillId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(DifficultyEnum)
  difficulty: DifficultyEnum;

  @IsString()
  @IsOptional()
  topics?: string;

  @IsObject()
  templateCode: Record<string, string>;

  @IsArray()
  testCases: Array<{ input: string; output: string }>;

  @IsOptional()
  examples?: any;

  @IsOptional()
  constraints?: any;

  @IsOptional()
  hints?: any;
}

export class UpdateChallengeDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(DifficultyEnum)
  @IsOptional()
  difficulty?: DifficultyEnum;

  @IsString()
  @IsOptional()
  topics?: string;

  @IsObject()
  @IsOptional()
  templateCode?: Record<string, string>;

  @IsArray()
  @IsOptional()
  testCases?: Array<{ input: string; output: string }>;

  @IsOptional()
  examples?: any;

  @IsOptional()
  constraints?: any;

  @IsOptional()
  hints?: any;
}

export class CreateSkillDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  icon?: string;
}

export class UpdateSkillDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  icon?: string;
}

export class UpdateUserRoleDto {
  @IsEnum(['USER', 'ADMIN'])
  role: string;
}
