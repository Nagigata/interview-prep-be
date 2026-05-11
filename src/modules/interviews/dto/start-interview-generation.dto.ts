import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class StartInterviewGenerationDto {
  @IsString()
  @IsNotEmpty()
  role: string;

  @IsString()
  @IsNotEmpty()
  level: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  techstack: string;

  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(10)
  amount: number;

  @IsOptional()
  @IsString()
  @IsIn(['en', 'vi'])
  language?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  userid?: string;
}
