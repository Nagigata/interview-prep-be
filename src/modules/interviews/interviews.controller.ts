import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { InterviewsService } from './interviews.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InterviewGenerationJobsService } from './interview-generation-jobs.service';

@Controller('interviews')
export class InterviewsController {
  constructor(
    private readonly interviewsService: InterviewsService,
    private readonly generationJobsService: InterviewGenerationJobsService,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() createInterviewDto: CreateInterviewDto,
  ) {
    return this.interviewsService.create(user.id, createInterviewDto);
  }

  @Get()
  async findMine(@CurrentUser() user: { id: string }) {
    return this.interviewsService.findByUserId(user.id);
  }

  @Get('latest')
  async findLatest(
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: string,
  ) {
    return this.interviewsService.findLatest(
      user.id,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('attempted')
  async findAttempted(@CurrentUser() user: { id: string }) {
    return this.interviewsService.findAttemptedByUserId(user.id);
  }

  @Get('generation-jobs/active')
  async findActiveGenerationJob(@CurrentUser() user: { id: string }) {
    return this.generationJobsService.getLatestForUser(user.id);
  }

  @Get('generation-jobs/:jobId')
  async findGenerationJob(
    @CurrentUser() user: { id: string },
    @Param('jobId') jobId: string,
  ) {
    return this.generationJobsService.getByIdForUser(jobId, user.id);
  }

  @Get(':id/attempts')
  async findAttempts(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.interviewsService.findAttemptsByInterviewId(id, user.id);
  }

  @Get('attempts/:id')
  async findAttempt(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.interviewsService.findAttemptByIdForUser(id, user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.interviewsService.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateInterviewDto>,
  ) {
    return this.interviewsService.update(id, updateData);
  }

  @Post(':id/attempts')
  async createAttempt(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.interviewsService.createAttempt(id, user.id);
  }

  @Post(':id/star')
  async toggleStar(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.interviewsService.toggleInterviewStar(user.id, id);
  }

  @Post('attempts/:id/transcripts')
  async saveTranscripts(
    @Param('id') id: string,
    @Body() body: { transcripts: { role: string; content: string }[] },
  ) {
    return this.interviewsService.saveTranscripts(id, body.transcripts);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.interviewsService.deleteInterview(id, user.id);
  }
}
