import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsObject,
  IsArray,
  IsBoolean,
} from 'class-validator';

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

  @IsString()
  @IsOptional()
  solution?: string;

  @IsOptional()
  followUps?: any;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateChallengeDto {
  @IsString()
  @IsOptional()
  skillId?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  slug?: string;

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

  @IsString()
  @IsOptional()
  solution?: string;

  @IsOptional()
  followUps?: any;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
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

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateSkillDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateUserRoleDto {
  @IsEnum(['USER', 'ADMIN'])
  @IsOptional()
  role?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
