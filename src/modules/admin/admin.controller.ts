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
import { AdminService } from './admin.service';
import { AdminGuard } from '../../common/guards/admin.guard';
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
  constructor(private readonly adminService: AdminService) {}

  // ===== DASHBOARD =====

  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }

  // ===== USERS =====

  @Get('users')
  async getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers({
      ...parsePagination(page, limit),
      search: search || undefined,
    });
  }

  @Get('users/:id')
  async getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Patch('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: UpdateUserRoleDto,
    @Req() req: any,
  ) {
    // Prevent admin from demoting themselves
    if (req.user?.id === id && body.role !== 'ADMIN') {
      throw new ForbiddenException('Cannot change your own role.');
    }
    return this.adminService.updateUser(id, body);
  }

  // ===== INTERVIEWS =====

  @Get('interviews')
  async getInterviews(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getInterviews({
      ...parsePagination(page, limit),
      search: search || undefined,
    });
  }

  // ===== CHALLENGES =====

  @Get('challenges')
  async getChallenges(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getChallenges({
      ...parsePagination(page, limit),
      search: search || undefined,
    });
  }

  @Post('challenges')
  async createChallenge(@Body() body: CreateChallengeDto) {
    return this.adminService.createChallenge(body);
  }

  @Patch('challenges/:id')
  async updateChallenge(@Param('id') id: string, @Body() body: UpdateChallengeDto) {
    return this.adminService.updateChallenge(id, body);
  }

  @Delete('challenges/:id')
  async deleteChallenge(@Param('id') id: string) {
    return this.adminService.deleteChallenge(id);
  }

  // ===== SKILLS =====

  @Get('skills')
  async getSkills() {
    return this.adminService.getSkills();
  }

  @Post('skills')
  async createSkill(@Body() body: CreateSkillDto) {
    return this.adminService.createSkill(body);
  }

  @Patch('skills/:id')
  async updateSkill(@Param('id') id: string, @Body() body: UpdateSkillDto) {
    return this.adminService.updateSkill(id, body);
  }
}
