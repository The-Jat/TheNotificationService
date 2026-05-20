import { Injectable } from '@nestjs/common';

import { EmailService }
from '../channels/email.service';

import { SmsService }
from '../channels/sms.service';

import { PushService }
from '../channels/push.service';

import { WebhookService }
from '../channels/webhook.service';

import { NOTIFICATION_RULES }
from '../rules/notification-rules';

@Injectable()
export class NotificationOrchestratorService {

  constructor(
    private emailService:
      EmailService,

    private smsService:
      SmsService,

    private pushService:
      PushService,

    private webhookService:
      WebhookService,
  ) {}

  async handle(
    event: string,
    payload: any,
  ) {

    const rules =
      NOTIFICATION_RULES[event];

    if (!rules) return;

    // EMAIL
    if (rules.email) {

      await this.emailService
        .sendWelcomeEmail(
          payload.email,
          payload.name,
        );
    }

    // SMS
    if (rules.sms) {

      await this.smsService.send(
        payload.phone || 'N/A',
        'Notification message',
      );
    }

    // PUSH
    if (rules.push) {

      await this.pushService.send(
        payload.userId,
        'Welcome notification',
      );
    }

    // WEBHOOK
    if (rules.webhook) {

      await this.webhookService.send(
        'https://example.com/webhook',
        payload,
      );
    }
  }
}