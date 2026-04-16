import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_APP_PASSWORD,
      },
    });
  }

  async sendResetCode(email: string, code: string): Promise<boolean> {
    const mailOptions = {
      from: `"PrepWise" <${process.env.MAIL_USER}>`,
      to: email,
      subject: 'Reset Your Password - PrepWise',
      html: `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #1a1a2e; border-radius: 16px; color: #e0e0e0;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #a78bfa; margin: 0; font-size: 28px;">PrepWise</h1>
            <p style="color: #888; margin-top: 4px;">AI Mock Interview Platform</p>
          </div>
          <hr style="border: none; border-top: 1px solid #333; margin: 16px 0;" />
          <p style="font-size: 16px; line-height: 1.6;">
            You requested to reset your password. Use the verification code below:
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <div style="display: inline-block; background: #16213e; border: 2px solid #a78bfa; border-radius: 12px; padding: 16px 40px; letter-spacing: 8px; font-size: 32px; font-weight: bold; color: #a78bfa;">
              ${code}
            </div>
          </div>
          <p style="font-size: 14px; color: #888; text-align: center;">
            This code expires in <strong style="color: #e0e0e0;">5 minutes</strong>.
          </p>
          <hr style="border: none; border-top: 1px solid #333; margin: 24px 0;" />
          <p style="font-size: 12px; color: #666; text-align: center;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Reset code sent to ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${email}`, error);
      return false;
    }
  }
}
