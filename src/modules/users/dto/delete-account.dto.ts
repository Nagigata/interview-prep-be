import { Equals, IsOptional, IsString } from 'class-validator';

export class DeleteAccountDto {
  @IsOptional()
  @IsString()
  password?: string;

  @IsString()
  @Equals('DELETE', {
    message: 'You must type DELETE to confirm account deletion.',
  })
  confirmText: string;
}
