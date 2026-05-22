import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminInterviewsService } from './services/admin-interviews.service';
import { AdminChallengesService } from './services/admin-challenges.service';
import { AdminSkillsService } from './services/admin-skills.service';
import { AdminAuditLogService } from './services/admin-audit-log.service';
import { AdminSolutionsService } from './services/admin-solutions.service';
import { AdminCommentsService } from './services/admin-comments.service';

@Module({
  controllers: [AdminController],
  providers: [
    AdminDashboardService,
    AdminUsersService,
    AdminInterviewsService,
    AdminChallengesService,
    AdminSkillsService,
    AdminAuditLogService,
    AdminSolutionsService,
    AdminCommentsService,
  ],
})
export class AdminModule {}
