import {
  BadRequestException,
  Controller,
  Post,
  Body,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Param,
  Req,
  Res,
  Query,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthGuard } from '@nestjs/passport';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  buildClearLinkCookieHeader,
  buildLinkCookieHeader,
} from './utils/link-cookie';

type SupportedProvider = 'google' | 'github';

const isSupportedProvider = (p: string): p is SupportedProvider =>
  p === 'google' || p === 'github';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // ===== FORGOT PASSWORD =====

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('verify-code')
  @HttpCode(HttpStatus.OK)
  async verifyCode(@Body() dto: VerifyCodeDto) {
    return this.authService.verifyResetCode(dto.email, dto.code);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.resetToken, dto.newPassword);
  }

  @Post('set-password')
  @HttpCode(HttpStatus.OK)
  async setPassword(
    @CurrentUser('id') userId: string,
    @Body() dto: SetPasswordDto,
  ) {
    return this.authService.setPassword(userId, dto.newPassword);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  // ===== OAUTH =====

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req: any) {}

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: any, @Res() res: any) {
    return this.handleOAuthCallback(req, res, 'google');
  }

  @Public()
  @Get('github')
  @UseGuards(AuthGuard('github'))
  async githubAuth(@Req() req: any) {}

  @Public()
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubAuthRedirect(@Req() req: any, @Res() res: any) {
    return this.handleOAuthCallback(req, res, 'github');
  }

  // ===== OAUTH LINKING =====

  @Public()
  @Get('link/:provider')
  async linkProviderInit(
    @Param('provider') provider: string,
    @Query('t') token: string,
    @Res() res: any,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

    if (!isSupportedProvider(provider)) {
      return res.redirect(
        `${frontendUrl}/settings?tab=account&linked=error&msg=${encodeURIComponent('Unsupported provider')}`,
      );
    }
    if (!token) {
      return res.redirect(
        `${frontendUrl}/settings?tab=account&linked=error&msg=${encodeURIComponent('Missing auth token')}`,
      );
    }

    let userId: string;
    try {
      const payload: any = this.jwtService.verify(token);
      userId = payload?.sub;
      if (!userId) throw new Error('Invalid token payload');
    } catch {
      return res.redirect(
        `${frontendUrl}/settings?tab=account&linked=error&msg=${encodeURIComponent('Invalid or expired token')}`,
      );
    }

    res.setHeader('Set-Cookie', buildLinkCookieHeader(userId));
    return res.redirect(`${backendUrl}/api/auth/${provider}`);
  }

  @Delete('unlink/:provider')
  @HttpCode(HttpStatus.OK)
  async unlinkProvider(
    @CurrentUser('id') userId: string,
    @Param('provider') provider: string,
  ) {
    if (!isSupportedProvider(provider)) {
      throw new BadRequestException('Unsupported provider');
    }
    const normalized = provider.toUpperCase() as 'GOOGLE' | 'GITHUB';
    return this.usersService.unlinkOAuthProvider(userId, normalized);
  }

  private async handleOAuthCallback(
    req: any,
    res: any,
    provider: SupportedProvider,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const payload = req.user || {};
    const settingsBase = `${frontendUrl}/settings?tab=account`;

    if (payload.mode === 'link') {
      // Always clear the link cookie after this round-trip, success or not
      res.setHeader('Set-Cookie', buildClearLinkCookieHeader());

      if (payload.error) {
        return res.redirect(
          `${settingsBase}&linked=error&provider=${provider}&msg=${encodeURIComponent(payload.error)}`,
        );
      }
      return res.redirect(`${settingsBase}&linked=ok&provider=${provider}`);
    }

    const token = payload.accessToken;
    return res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  }
}
