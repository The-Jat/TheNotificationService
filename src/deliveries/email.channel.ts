import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config';
import { Rendered } from '../templates/templates';

export class ChannelNotConfigured extends Error {}

/** SMTP email. Works with any provider: Amazon SES, Brevo, Mailtrap, Gmail app passwords… */
@Injectable()
export class EmailChannel {
  private readonly logger = new Logger(EmailChannel.name);
  private readonly transporter?: Transporter;

  constructor() {
    if (config.smtp.host) {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
    } else {
      this.logger.warn('SMTP_HOST is not set; emails will be marked "skipped" instead of sent.');
    }
  }

  get configured() {
    return !!this.transporter;
  }

  async send(to: string, message: Rendered): Promise<string> {
    if (!this.transporter) throw new ChannelNotConfigured('SMTP is not configured');
    const info = await this.transporter.sendMail({
      from: config.smtp.from,
      to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    return String(info.messageId ?? '');
  }
}
