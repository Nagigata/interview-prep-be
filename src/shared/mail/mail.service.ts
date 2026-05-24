import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { promises as fs } from 'fs';
import { join } from 'path';

const LOGO_CID = 'prepwise-logo';
const LOGO_PATH = join(
  process.cwd(),
  '..',
  'ai-mock-interviews',
  'app',
  'favicon.ico',
);

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);
  private logoBufferPromise: Promise<Buffer | null> | null = null;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_APP_PASSWORD,
      },
    });
  }

  private async loadLogo(): Promise<Buffer | null> {
    if (!this.logoBufferPromise) {
      this.logoBufferPromise = fs.readFile(LOGO_PATH).catch((err) => {
        this.logger.warn(
          `Logo not found at ${LOGO_PATH}; falling back to text mark (${err.message})`,
        );
        return null;
      });
    }
    return this.logoBufferPromise;
  }

  async sendResetCode(email: string, code: string): Promise<boolean> {
    const year = new Date().getFullYear();
    const logo = await this.loadLogo();

    const mailOptions: nodemailer.SendMailOptions = {
      from: `"PrepWise" <${process.env.MAIL_USER}>`,
      to: email,
      subject: `Your PrepWise verification code: ${code}`,
      text: [
        `Your PrepWise verification code is ${code}.`,
        `This code expires in 5 minutes.`,
        `If you didn't request a password reset, you can safely ignore this email.`,
      ].join('\n\n'),
      html: this.renderResetCodeHtml(code, year, logo !== null),
      attachments: logo
        ? [
            {
              filename: 'prepwise-logo.ico',
              content: logo,
              cid: LOGO_CID,
              contentType: 'image/x-icon',
            },
          ]
        : undefined,
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

  private renderResetCodeHtml(
    code: string,
    year: number,
    hasLogo: boolean,
  ): string {
    const logoMark = hasLogo
      ? `<img src="cid:${LOGO_CID}" width="32" height="27" alt="PrepWise" style="display:inline-block;width:32px;height:27px;border:0;outline:none;vertical-align:middle;" />`
      : `<span style="display:inline-block;width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#7c3aed 0%,#a78bfa 100%);text-align:center;line-height:36px;color:#ffffff;font-weight:700;font-size:18px;vertical-align:middle;">P</span>`;

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PrepWise verification code</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;mso-hide:all;">
      Your PrepWise verification code is ${code}. It expires in 5 minutes.
    </span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f7;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;box-shadow:0 1px 2px rgba(15,23,42,0.04),0 8px 24px rgba(15,23,42,0.06);overflow:hidden;">
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      ${logoMark}
                      <span style="display:inline-block;vertical-align:middle;margin-left:10px;font-size:18px;font-weight:600;color:#0f172a;letter-spacing:-0.01em;">PrepWise</span>
                    </td>
                    <td align="right" style="vertical-align:middle;font-size:12px;color:#64748b;">
                      Account security
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 0 40px;">
                <h1 style="margin:0;font-size:22px;line-height:1.35;font-weight:600;color:#0f172a;letter-spacing:-0.01em;">Reset your password</h1>
                <p style="margin:12px 0 0 0;font-size:15px;line-height:1.6;color:#475569;">
                  Use the verification code below to confirm it's you. The code is valid for the next <strong style="color:#0f172a;">5 minutes</strong>.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 0 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" style="padding:20px;background-color:#f8f7ff;border:1px solid #e9e5ff;border-radius:12px;">
                      <div style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:0.4em;color:#5b21b6;padding-left:0.4em;">
                        ${code}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 0 40px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                  If you didn't request this code, you can safely ignore this email &mdash; your password won't change. For your safety, never share this code with anyone, including PrepWise staff.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px 32px 40px;">
                <hr style="border:none;border-top:1px solid #eef2f7;margin:0 0 20px 0;" />
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size:12px;color:#94a3b8;line-height:1.6;">
                      &copy; ${year} PrepWise &middot; AI Mock Interview Platform
                    </td>
                    <td align="right" style="font-size:12px;color:#94a3b8;">
                      This is an automated message.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0 0;font-size:11px;color:#94a3b8;">
            Sent to verify a password reset request on your PrepWise account.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }
}
