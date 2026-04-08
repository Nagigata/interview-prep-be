import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { FeedbacksService } from './feedbacks.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('feedbacks')
export class FeedbacksController {
  constructor(private readonly feedbacksService: FeedbacksService) {}

  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() createFeedbackDto: CreateFeedbackDto,
  ) {
    return this.feedbacksService.create(user.id, createFeedbackDto);
  }

  @Get('interview/:interviewId')
  async findByInterview(
    @CurrentUser() user: { id: string },
    @Param('interviewId') interviewId: string,
  ) {
    return this.feedbacksService.findByInterviewId(interviewId, user.id);
  }
}
