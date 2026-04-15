import { Controller, Get, Post, Param, Query, Req } from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challengesService: ChallengesService) {}

  @Get('skills')
  async getSkills() {
    return this.challengesService.getAllSkills();
  }

  @Get('skill/:slug')
  async getChallengesBySkill(
    @Param('slug') slug: string,
    @Req() req: any,
    @Query('difficulty') difficulty?: string | string[],
    @Query('topics') topics?: string | string[],
    @Query('status') status?: string | string[],
  ) {
    const userId = req.user.id;
    return this.challengesService.getChallengesBySkill(slug, userId, {
      difficulty: Array.isArray(difficulty) ? difficulty : difficulty ? [difficulty] : [],
      topics: Array.isArray(topics) ? topics : topics ? [topics] : [],
      status: Array.isArray(status) ? status : status ? [status] : [],
    });
  }

  @Post(':id/star')
  async toggleStar(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id;
    return this.challengesService.toggleChallengeStar(userId, id);
  }

  @Get(':id')
  async getChallenge(@Param('id') id: string) {
    return this.challengesService.getChallengeById(id);
  }

  @Get()
  async getAllChallenges(
    @Req() req: any,
    @Query('difficulty') difficulty?: string | string[],
    @Query('topics') topics?: string | string[],
    @Query('status') status?: string | string[],
    @Query('skill') skillSlug?: string,
  ) {
    const userId = req.user.id;
    return this.challengesService.getAllChallenges(userId, {
      difficulty: Array.isArray(difficulty) ? difficulty : difficulty ? [difficulty] : [],
      topics: Array.isArray(topics) ? topics : topics ? [topics] : [],
      status: Array.isArray(status) ? status : status ? [status] : [],
      skillSlug,
    });
  }
}
