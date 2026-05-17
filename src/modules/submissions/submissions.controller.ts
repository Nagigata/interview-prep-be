import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  Param,
  Query,
  Patch,
} from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UpdateSubmissionNoteDto } from './dto/update-submission-note.dto';

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('challenge/:challengeId')
  async getChallengeSubmissionHistory(
    @Req() req: any,
    @Param('challengeId') challengeId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('language') language?: string,
  ) {
    return this.submissionsService.getChallengeSubmissionHistory(
      challengeId,
      req.user.id,
      {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        status,
        language,
      },
    );
  }

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

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getSubmissionDetail(@Req() req: any, @Param('id') id: string) {
    return this.submissionsService.getSubmissionDetail(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/note')
  async updateSubmissionNote(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateSubmissionNoteDto,
  ) {
    return this.submissionsService.updateSubmissionNote(
      id,
      req.user.id,
      body.note,
      body.noteColor,
    );
  }
}
