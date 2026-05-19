import { Module } from '@nestjs/common';

import { EventsModule } from 'src/core/events/events.module';

import { UserCreatedConsumer } from './consumers/user-created.consumer';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    EventsModule,
    ConfigModule.forRoot({
        isGlobal: true,
    }),
],

  providers: [
    UserCreatedConsumer,
  ],
})
export class NotificationsModule {}