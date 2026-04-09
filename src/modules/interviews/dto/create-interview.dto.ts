import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class CreateInterviewDto {
  @IsString()
  @IsNotEmpty()
  role: string;

  @IsString()
  @IsNotEmpty()
  level: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsArray()
  @IsString({ each: true })
  techstack: string[];

  @IsString()
  @IsOptional()
  language?: string;

  @IsArray()
  @IsString({ each: true })
  questions: string[];

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsBoolean()
  finalized?: boolean;
}
