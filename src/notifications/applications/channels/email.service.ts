import { Injectable, Logger } from '@nestjs/common';

import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private logger = new Logger(
    EmailService.name,
  );

  private transporter =
    nodemailer.createTransport({
      host:
        process.env.SMTP_HOST,

      port: Number(
        process.env.SMTP_PORT,
      ),

      secure: false,

      auth: {
        user:
          process.env.SMTP_USER,

        pass:
          process.env.SMTP_PASS,
      },
    });

  async sendWelcomeEmail(
    email: string,
    name: string,
  ) {
    const info =
      await this.transporter.sendMail({
        from:
          '"The Auth Platform" <noreply@theauth.com>',

        to: email,

        subject:
          'Welcome to The Auth Platform',

        html: `
          <h1>Welcome ${name}</h1>

          <p>
            Your account has been created successfully.
          </p>
        `,
      });

    this.logger.log(
      `Email sent: ${info.messageId}`,
    );
  }
}