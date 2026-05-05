import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../shared/prisma/prisma.service';
import { MailService } from '../../shared/mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { name, email, password } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create the user
    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        'Your account has been deactivated. Please contact an administrator.',
      );
    }

    if (!user.password) {
      throw new UnauthorizedException(
        'Please sign in using your linked Google or GitHub account.',
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.generateToken(user);
  }

  async generateToken(user: any) {
    const payload = {
      sub: user.id, // Subject matches JwtStrategy
      email: user.email,
      name: user.name,
      role: user.role || 'USER',
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'USER',
        isActive: user.isActive ?? true,
      },
    };
  }

  async validateUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        'Your account has been deactivated. Please contact an administrator.',
      );
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
  }

  async validateOAuthLogin(profile: {
    email: string;
    name: string;
    providerId: string;
    provider: string;
    avatarUrl?: string;
  }) {
    let user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          provider: profile.provider,
          providerId: profile.providerId,
          avatarUrl: profile.avatarUrl,
        },
      });
    } else {
      // Update provider info and avatar if needed
      const updateData: Record<string, any> = {};

      if (!user.provider || user.provider === 'LOCAL') {
        updateData.provider = profile.provider;
        updateData.providerId = profile.providerId;
      }

      if (profile.avatarUrl && !user.avatarUrl) {
        updateData.avatarUrl = profile.avatarUrl;
      }

      if (Object.keys(updateData).length > 0) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        'Your account has been deactivated. Please contact an administrator.',
      );
    }

    // Reuse the generic token generator
    return this.generateToken(user);
  }

  // ===== FORGOT PASSWORD FLOW =====

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('No account found with this email.');
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetCode: code,
        resetCodeExpiry: expiry,
        resetToken: null,
      },
    });

    const sent = await this.mailService.sendResetCode(email, code);
    if (!sent) {
      throw new BadRequestException('Failed to send email. Please try again.');
    }

    return { message: 'Verification code sent to your email.' };
  }

  async verifyResetCode(email: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.resetCode || !user.resetCodeExpiry) {
      throw new BadRequestException('Invalid request. Please try again.');
    }

    if (new Date() > user.resetCodeExpiry) {
      throw new BadRequestException('Verification code has expired.');
    }

    if (user.resetCode !== code) {
      throw new BadRequestException('Invalid verification code.');
    }

    // Generate a one-time reset token with 15-minute expiry
    const resetToken = crypto.randomUUID();
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetCode: null,
        resetCodeExpiry: null,
        resetToken,
        resetTokenExpiry,
      },
    });

    return { resetToken };
  }

  async resetPassword(resetToken: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: { resetToken },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token.');
    }

    if (!user.resetTokenExpiry || new Date() > user.resetTokenExpiry) {
      // Clean up expired or legacy token without expiry
      await this.prisma.user.update({
        where: { id: user.id },
        data: { resetToken: null, resetTokenExpiry: null },
      });
      throw new BadRequestException('Reset token has expired. Please request a new one.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return { message: 'Password has been reset successfully.' };
  }
}
