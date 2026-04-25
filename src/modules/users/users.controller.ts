import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';

const avatarUploadPath = join(process.cwd(), 'uploads', 'avatars');

const ensureAvatarDir = () => {
  mkdirSync(avatarUploadPath, { recursive: true });
};

const imageFileFilter = (
  req: any,
  file: any,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!file.mimetype.startsWith('image/')) {
    return callback(
      new BadRequestException('Only image files are allowed') as any,
      false,
    );
  }

  callback(null, true);
};

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getProfile(
    @CurrentUser() user: { id: string },
    @Headers('x-timezone') timezone?: string,
  ) {
    return this.usersService.findById(user.id, timezone);
  }

  @Patch('me')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: (req: any, file: any, callback: any) => {
          ensureAvatarDir();
          callback(null, avatarUploadPath);
        },
        filename: (req: any, file: any, callback: any) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(
            null,
            `avatar-${uniqueSuffix}${extname(file.originalname).toLowerCase()}`,
          );
        },
      }),
      fileFilter: imageFileFilter,
      limits: {
        fileSize: 2 * 1024 * 1024,
      },
    }),
  )
  async updateProfile(
    @Body() updateProfileDto: UpdateProfileDto,
    @UploadedFile() avatar: any,
    @CurrentUser('id') userId: string,
  ) {
    return this.usersService.updateProfile(userId, updateProfileDto, avatar);
  }

  @Get('me/starred')
  async getStarredChallenges(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string | string[],
    @Query('difficulty') difficulty?: string | string[],
  ) {
    return this.usersService.getStarredChallenges(userId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      status: Array.isArray(status) ? status : status ? [status] : [],
      difficulty: Array.isArray(difficulty)
        ? difficulty
        : difficulty
          ? [difficulty]
          : [],
    });
  }

  @Get('me/solved')
  async getSolvedChallenges(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.getSolvedChallenges(userId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
    });
  }

  @Get('me/activity')
  async getRecentActivity(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.getRecentActivity(userId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('me/recommended-skills')
  async getRecommendedSkills(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.getRecommendedSkills(
      userId,
      limit ? parseInt(limit, 10) : 3,
    );
  }
}
