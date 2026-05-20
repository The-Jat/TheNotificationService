import { Module } from '@nestjs/common';

import { EventsModule } from 'src/core/events/events.module';

import { UserCreatedConsumer } from './consumers/user-created.consumer';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './applications/email.service';

@Module({
  imports: [
    EventsModule,
    ConfigModule.forRoot({
        isGlobal: true,
    }),
],

  providers: [
    UserCreatedConsumer,
    EmailService,
  ],
})
export class NotificationsModule {}