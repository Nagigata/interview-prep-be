import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SolutionsService } from './solutions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CreateSolutionDto } from './dto/create-solution.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Controller()
export class SolutionsController {
  constructor(private readonly solutionsService: SolutionsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('challenges/:challengeId/solutions')
  async createSolution(
    @Req() req: any,
    @Param('challengeId') challengeId: string,
    @Body() dto: CreateSolutionDto,
  ) {
    return this.solutionsService.createSolution(req.user.id, challengeId, dto);
  }

  @Public()
  @Get('challenges/:challengeId/solutions')
  async getSolutions(
    @Req() req: any,
    @Param('challengeId') challengeId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('language') language?: string,
    @Query('sort') sort?: string,
  ) {
    const allowedSorts = ['newest', 'top-views', 'top-votes'] as const;
    type SortKey = (typeof allowedSorts)[number];
    const normalizedSort: SortKey | undefined =
      sort && (allowedSorts as readonly string[]).includes(sort)
        ? (sort as SortKey)
        : undefined;

    return this.solutionsService.getSolutions(
      challengeId,
      req.user?.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      { language, sort: normalizedSort },
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('solutions/me')
  async getMySolutions(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.solutionsService.getMySolutions(
      req.user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('solutions/me/comments')
  async getMySolutionComments(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.solutionsService.getMySolutionComments(
      req.user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('solutions/user/:userId')
  async getUserSolutions(
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.solutionsService.getMySolutions(
      userId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('solutions/user/:userId/comments')
  async getUserSolutionComments(
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.solutionsService.getMySolutionComments(
      userId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  @Public()
  @Get('solutions/:solutionId')
  async getSolutionById(
    @Req() req: any,
    @Param('solutionId') solutionId: string,
  ) {
    return this.solutionsService.getSolutionById(solutionId, req.user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('solutions/:solutionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSolution(
    @Req() req: any,
    @Param('solutionId') solutionId: string,
  ) {
    return this.solutionsService.deleteSolution(req.user.id, solutionId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('solutions/:solutionId/upvote')
  async toggleSolutionUpvote(
    @Req() req: any,
    @Param('solutionId') solutionId: string,
  ) {
    return this.solutionsService.toggleSolutionUpvote(req.user.id, solutionId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('solutions/:solutionId/comments')
  async createComment(
    @Req() req: any,
    @Param('solutionId') solutionId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.solutionsService.createComment(req.user.id, solutionId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('solutions/:solutionId/comments/:commentId')
  async updateComment(
    @Req() req: any,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.solutionsService.updateComment(req.user.id, commentId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('solutions/:solutionId/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(@Req() req: any, @Param('commentId') commentId: string) {
    return this.solutionsService.deleteComment(req.user.id, commentId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('solutions/:solutionId/comments/:commentId/upvote')
  async toggleCommentUpvote(
    @Req() req: any,
    @Param('commentId') commentId: string,
  ) {
    return this.solutionsService.toggleCommentUpvote(req.user.id, commentId);
  }
}
