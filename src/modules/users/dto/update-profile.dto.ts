import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum GenderDto {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  PREFER_NOT_TO_SAY = 'PREFER_NOT_TO_SAY',
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsEnum(GenderDto)
  gender?: GenderDto;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  birthday?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readme?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  notifyInterviewActivity?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  notifyComments?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  notifySound?: boolean;

  // AI Model Preferences
  @IsOptional()
  @IsString()
  @IsIn(['local-qwen', 'gemini', 'openai', 'anthropic'])
  aiQuestionProvider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  aiQuestionModel?: string;

  @IsOptional()
  @IsString()
  @IsIn(['local-qwen', 'gemini', 'openai', 'anthropic'])
  aiFeedbackProvider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  aiFeedbackModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  aiGeminiApiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  aiOpenaiApiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  aiAnthropicApiKey?: string;
}
