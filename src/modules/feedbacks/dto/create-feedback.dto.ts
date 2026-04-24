import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class TranscriptItemDto {
  @IsString()
  @IsNotEmpty()
  role: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}

export class CreateFeedbackDto {
  @IsString()
  @IsNotEmpty()
  attemptId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranscriptItemDto)
  transcript: TranscriptItemDto[];
}
