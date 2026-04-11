import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('run')
  async runCode(
    @Req() req: any,
    @Body() body: { challengeId: string; code: string; language: string },
  ) {
    const userId = req.user.id;
    return this.submissionsService.runCode(
      body.challengeId,
      userId,
      body.code,
      body.language,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('submit')
  async submitCode(
    @Req() req: any,
    @Body() body: { challengeId: string; code: string; language: string },
  ) {
    const userId = req.user.id;
    return this.submissionsService.submitCode(
      body.challengeId,
      userId,
      body.code,
      body.language,
    );
  }
}
