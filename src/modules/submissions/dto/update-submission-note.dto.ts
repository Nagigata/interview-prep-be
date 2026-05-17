import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSubmissionNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(['gray', 'yellow', 'blue', 'green', 'pink', 'purple'])
  noteColor?: string | null;
}
