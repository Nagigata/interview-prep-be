import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { extractLinkUserId } from '../utils/link-cookie';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly authService: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || '123',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '123',
      callbackURL: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/auth/google/callback`,
      scope: ['email', 'profile'],
      passReqToCallback: true,
    } as any);
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, id, photos } = profile;
    const profileData = {
      email: emails[0].value,
      name: name.givenName + (name.familyName ? ' ' + name.familyName : ''),
      providerId: id,
      provider: 'GOOGLE' as const,
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
