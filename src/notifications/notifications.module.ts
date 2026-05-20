import { Module } from '@nestjs/common';

import { EventsModule } from 'src/core/events/events.module';

import { UserCreatedConsumer } from './consumers/user-created.consumer';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './applications/channels/email.service';
import { NotificationOrchestratorService } from './applications/orchestrators/notification-orchestrator.service';
import { SmsService } from './applications/channels/sms.service';
import { PushService } from './applications/channels/push.service';
import { WebhookService } from './applications/channels/webhook.service';

@Module({
  imports: [
    EventsModule,
    ConfigModule.forRoot({
        isGlobal: true,
    }),
],

  providers: [
    UserCreatedConsumer,

    NotificationOrchestratorService,
    
    EmailService,
    SmsService,
    PushService,
    WebhookService,
  ],
})
export class NotificationsModule {}