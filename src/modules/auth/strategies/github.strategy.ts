import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private readonly authService: AuthService) {
    super({
      clientID: process.env.GITHUB_CLIENT_ID || '123',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '123',
      callbackURL: 'http://localhost:3001/api/auth/github/callback',
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: any,
  ): Promise<any> {
    const { username, emails, id, photos, displayName } = profile;
    const user = {
      email: emails?.[0]?.value || `${username}@github.com`,
      name: displayName || username,
      providerId: id,
      provider: 'GITHUB',
      avatarUrl: photos?.[0]?.value,
    };
    const finalUser = await this.authService.validateOAuthLogin(user);
    done(null, finalUser);
  }
}
