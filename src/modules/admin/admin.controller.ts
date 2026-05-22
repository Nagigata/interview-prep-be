import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminInterviewsService } from './services/admin-interviews.service';
import { AdminChallengesService } from './services/admin-challenges.service';
import { AdminSkillsService } from './services/admin-skills.service';
import { AdminAuditLogService } from './services/admin-audit-log.service';
import { AdminSolutionsService } from './services/admin-solutions.service';
import { AdminCommentsService } from './services/admin-comments.service';
import {
  CreateChallengeDto,
  UpdateChallengeDto,
  CreateSkillDto,
  UpdateSkillDto,
  UpdateUserRoleDto,
  DeleteAdminContentDto,
} from './dto/admin.dto';

function parsePagination(page?: string, limit?: string) {
  const p = parseInt(page || '', 10);
  const l = parseInt(limit || '', 10);
  return {
    page: Number.isFinite(p) && p >= 1 ? p : 1,
    limit: Number.isFinite(l) ? Math.min(Math.max(l, 1), 50) : 10,
  };
}

function getAuditContext(req: any) {
  return {
    adminId: req.user.id,
    ipAddress: req.ip || req.headers?.['x-forwarded-for'],
    userAgent: req.headers?.['user-agent'],
  };
}

@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly dashboardService: AdminDashboardService,
    private readonly usersService: AdminUsersService,
    private readonly interviewsService: AdminInterviewsService,
    private readonly challengesService: AdminChallengesService,
    private readonly skillsService: AdminSkillsService,
    private readonly auditLogService: AdminAuditLogService,
    private readonly solutionsService: AdminSolutionsService,
    private readonly commentsService: AdminCommentsService,
  ) {}

  // ===== DASHBOARD =====

  @Get('dashboard')
  async getDashboard(@Query('range') range?: string) {
    return this.dashboardService.getDashboardStats(range);
  }

  @Get('stats')
  async getStats(@Query('range') range?: string) {
    return this.dashboardService.getStats(range);
  }

  @Get('audit-logs')
  async getAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
  ) {
    return this.auditLogService.getLogs({
      ...parsePagination(page, limit),
      search: search || undefined,
      action: action || undefined,
      entityType: entityType || undefined,
    });
  }

  // ===== USERS =====

  @Get('users')
  async getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    return this.usersService.getUsers({
      ...parsePagination(page, limit),
      search: search || undefined,
      role: role || undefined,
      status: status || undefined,
    });
  }

  @Get('users/:id')
  async getUserDetail(@Param('id') id: string) {
    return this.usersService.getUserDetail(id);
  }

  @Patch('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: UpdateUserRoleDto,
    @Req() req: any,
  ) {
    // Prevent admins from locking themselves out.
    if (
      req.user?.id === id &&
      body.role !== undefined &&
      body.role !== 'ADMIN'
    ) {
      throw new ForbiddenException('Cannot change your own role.');
    }
    if (req.user?.id === id && body.isActive === false) {
      throw new ForbiddenException('Cannot deactivate your own account.');
    }
    return this.usersService.updateUser(id, body, getAuditContext(req));
  }

  // ===== INTERVIEWS =====

  @Get('interviews')
  async getInterviews(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('level') level?: string,
  ) {
    return this.interviewsService.getInterviews({
      ...parsePagination(page, limit),
      search: search || undefined,
      status: status || undefined,
      type: type || undefined,
      level: level || undefined,
    });
  }

  @Get('interviews/:id')
  async getInterviewDetail(@Param('id') id: string) {
    return this.interviewsService.getInterviewDetail(id);
  }

  @Get('interviews/:id/attempts/:attemptId')
  async getInterviewAttemptDetail(
    @Param('id') id: string,
    @Param('attemptId') attemptId: string,
  ) {
    return this.interviewsService.getAttemptDetail(id, attemptId);
  }

  @Patch('interviews/:id/archive')
  async archiveInterview(@Param('id') id: string, @Req() req: any) {
    return this.interviewsService.setInterviewArchived(
      id,
      true,
      getAuditContext(req),
    );
  }

  @Patch('interviews/:id/restore')
  async restoreInterview(@Param('id') id: string, @Req() req: any) {
    return this.interviewsService.setInterviewArchived(
      id,
      false,
      getAuditContext(req),
    );
  }

  // ===== CHALLENGES =====

  @Get('challenges')
  async getChallenges(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('difficulty') difficulty?: string,
    @Query('skillId') skillId?: string,
  ) {
    return this.challengesService.getChallenges({
      ...parsePagination(page, limit),
      search: search || undefined,
      status: status || undefined,
      difficulty: difficulty || undefined,
      skillId: skillId || undefined,
    });
  }

  @Post('challenges')
  async createChallenge(@Body() body: CreateChallengeDto, @Req() req: any) {
    return this.challengesService.createChallenge(body, getAuditContext(req));
  }

  @Patch('challenges/:id')
  async updateChallenge(
    @Param('id') id: string,
    @Body() body: UpdateChallengeDto,
    @Req() req: any,
  ) {
    return this.challengesService.updateChallenge(
      id,
      body,
      getAuditContext(req),
    );
  }

  @Delete('challenges/:id')
  async deleteChallenge(@Param('id') id: string, @Req() req: any) {
    return this.challengesService.deleteChallenge(id, getAuditContext(req));
  }

  // ===== SOLUTIONS =====

  @Get('solutions')
  async getSolutions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('language') language?: string,
    @Query('challengeId') challengeId?: string,
    @Query('createdFrom') createdFrom?: string,
    @Query('createdTo') createdTo?: string,
  ) {
    return this.solutionsService.getSolutions({
      ...parsePagination(page, limit),
      search: search || undefined,
      language: language || undefined,
      challengeId: challengeId || undefined,
      createdFrom: createdFrom || undefined,
      createdTo: createdTo || undefined,
    });
  }

  @Get('solutions/:id')
  async getSolutionDetail(@Param('id') id: string) {
    return this.solutionsService.getSolutionDetail(id);
  }

  @Delete('solutions/:id')
  async deleteSolution(
    @Param('id') id: string,
    @Body() body: DeleteAdminContentDto,
    @Req() req: any,
  ) {
    return this.solutionsService.deleteSolution(
      id,
      body?.reason,
      getAuditContext(req),
    );
  }

  // ===== COMMENTS =====

  @Get('comments')
  async getComments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('hasReplies') hasReplies?: string,
    @Query('createdFrom') createdFrom?: string,
    @Query('createdTo') createdTo?: string,
  ) {
    return this.commentsService.getComments({
      ...parsePagination(page, limit),
      search: search || undefined,
      hasReplies: hasReplies || undefined,
      createdFrom: createdFrom || undefined,
      createdTo: createdTo || undefined,
    });
  }

  @Get('comments/:id')
  async getCommentDetail(@Param('id') id: string) {
    return this.commentsService.getCommentDetail(id);
  }

  @Delete('comments/:id')
  async deleteComment(
    @Param('id') id: string,
    @Body() body: DeleteAdminContentDto,
    @Req() req: any,
  ) {
    return this.commentsService.deleteComment(
      id,
      body?.reason,
      getAuditContext(req),
    );
  }

  // ===== SKILLS =====

  @Get('skills')
  async getSkills(@Query('status') status?: string) {
    return this.skillsService.getSkills({ status: status || undefined });
  }

  @Post('skills')
  async createSkill(@Body() body: CreateSkillDto, @Req() req: any) {
    return this.skillsService.createSkill(body, getAuditContext(req));
  }

  @Patch('skills/:id')
  async updateSkill(
    @Param('id') id: string,
    @Body() body: UpdateSkillDto,
    @Req() req: any,
  ) {
    return this.skillsService.updateSkill(id, body, getAuditContext(req));
  }

  @Delete('skills/:id')
  async deleteSkill(@Param('id') id: string, @Req() req: any) {
    return this.skillsService.deleteSkill(id, getAuditContext(req));
  }
}
