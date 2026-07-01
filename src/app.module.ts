import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './shared/prisma/prisma.module';
import { CryptoModule } from './shared/crypto/crypto.module';
import { RedisModule } from './shared/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { InterviewsModule } from './modules/interviews/interviews.module';
import { FeedbacksModule } from './modules/feedbacks/feedbacks.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ChallengesModule } from './modules/challenges/challenges.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';
import { MailModule } from './shared/mail/mail.module';
import { AdminModule } from './modules/admin/admin.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SolutionsModule } from './modules/solutions/solutions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    CryptoModule,
    RedisModule,
    AuthModule,
    UsersModule,
    InterviewsModule,
    FeedbacksModule,
    ChallengesModule,
    SubmissionsModule,
    MailModule,
    AdminModule,
    NotificationsModule,
    SolutionsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
