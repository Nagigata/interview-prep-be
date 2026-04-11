import { Controller, Get, Param } from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challengesService: ChallengesService) {}

  @Public()
  @Get('skills')
  async getSkills() {
    return this.challengesService.getAllSkills();
  }

  @Public()
  @Get('skill/:slug')
  async getChallengesBySkill(@Param('slug') slug: string) {
    return this.challengesService.getChallengesBySkill(slug);
  }

  @Public()
  @Get(':id')
  async getChallenge(@Param('id') id: string) {
    return this.challengesService.getChallengeById(id);
  }
}
