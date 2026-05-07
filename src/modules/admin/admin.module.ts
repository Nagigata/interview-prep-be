import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminInterviewsService } from './services/admin-interviews.service';
import { AdminChallengesService } from './services/admin-challenges.service';
import { AdminSkillsService } from './services/admin-skills.service';

@Module({
  controllers: [AdminController],
  providers: [
    AdminDashboardService,
    AdminUsersService,
    AdminInterviewsService,
    AdminChallengesService,
    AdminSkillsService,
  ],
})
export class AdminModule {}
