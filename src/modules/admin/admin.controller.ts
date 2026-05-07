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
import {
  CreateChallengeDto,
  UpdateChallengeDto,
  CreateSkillDto,
  UpdateSkillDto,
  UpdateUserRoleDto,
} from './dto/admin.dto';

function parsePagination(page?: string, limit?: string) {
  const p = parseInt(page || '', 10);
  const l = parseInt(limit || '', 10);
  return {
    page: Number.isFinite(p) && p >= 1 ? p : 1,
    limit: Number.isFinite(l) ? Math.min(Math.max(l, 1), 50) : 10,
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
  ) {}

  // ===== DASHBOARD =====

  @Get('dashboard')
  async getDashboard() {
    return this.dashboardService.getDashboardStats();
  }

  @Get('stats')
  async getStats() {
    return this.dashboardService.getStats();
  }

  // ===== USERS =====

  @Get('users')
  async getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.getUsers({
      ...parsePagination(page, limit),
      search: search || undefined,
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
    if (req.user?.id === id && body.role !== undefined && body.role !== 'ADMIN') {
      throw new ForbiddenException('Cannot change your own role.');
    }
    if (req.user?.id === id && body.isActive === false) {
      throw new ForbiddenException('Cannot deactivate your own account.');
    }
    return this.usersService.updateUser(id, body);
  }

  // ===== INTERVIEWS =====

  @Get('interviews')
  async getInterviews(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.interviewsService.getInterviews({
      ...parsePagination(page, limit),
      search: search || undefined,
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
  async archiveInterview(@Param('id') id: string) {
    return this.interviewsService.setInterviewArchived(id, true);
  }

  @Patch('interviews/:id/restore')
  async restoreInterview(@Param('id') id: string) {
    return this.interviewsService.setInterviewArchived(id, false);
  }

  // ===== CHALLENGES =====

  @Get('challenges')
  async getChallenges(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.challengesService.getChallenges({
      ...parsePagination(page, limit),
      search: search || undefined,
    });
  }

  @Post('challenges')
  async createChallenge(@Body() body: CreateChallengeDto) {
    return this.challengesService.createChallenge(body);
  }

  @Patch('challenges/:id')
  async updateChallenge(@Param('id') id: string, @Body() body: UpdateChallengeDto) {
    return this.challengesService.updateChallenge(id, body);
  }

  @Delete('challenges/:id')
  async deleteChallenge(@Param('id') id: string) {
    return this.challengesService.deleteChallenge(id);
  }

  // ===== SKILLS =====

  @Get('skills')
  async getSkills() {
    return this.skillsService.getSkills();
  }

  @Post('skills')
  async createSkill(@Body() body: CreateSkillDto) {
    return this.skillsService.createSkill(body);
  }

  @Patch('skills/:id')
  async updateSkill(@Param('id') id: string, @Body() body: UpdateSkillDto) {
    return this.skillsService.updateSkill(id, body);
  }

  @Delete('skills/:id')
  async deleteSkill(@Param('id') id: string) {
    return this.skillsService.deleteSkill(id);
  }
}
