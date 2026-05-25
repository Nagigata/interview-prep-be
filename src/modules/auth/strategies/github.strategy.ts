import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { extractLinkUserId } from '../utils/link-cookie';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private readonly authService: AuthService) {
    super({
      clientID: process.env.GITHUB_CLIENT_ID || '123',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '123',
      callbackURL: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/auth/github/callback`,
      scope: ['user:email'],
      passReqToCallback: true,
    } as any);
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: any,
  ): Promise<any> {
    const { username, emails, id, photos, displayName } = profile;
    const profileData = {
      email: emails?.[0]?.value || `${username}@github.com`,
      name: displayName || username,
      providerId: id,
      provider: 'GITHUB' as const,
      avatarUrl: photos?.[0]?.value,
    };

    const linkUserId = extractLinkUserId(req);
    if (linkUserId) {
      try {
        const result = await this.authService.handleOAuthLink(
          linkUserId,
          profileData,
        );
        return done(null, { mode: 'link', ...result } as any);
      } catch (err: any) {
        return done(null, {
          mode: 'link',
          error: err?.message || 'Failed to link account.',
        } as any);
      }
    }

    const finalUser = await this.authService.validateOAuthLogin(profileData);
    done(null, { mode: 'login', ...finalUser } as any);
  }
}
