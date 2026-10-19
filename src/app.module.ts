import { Module } from '@nestjs/common';
import { BusPublisher } from './bus/publisher';
import { DatabaseModule } from './database/database.service';
import { DeliveriesController, NotificationConsumer } from './deliveries/deliveries.controller';
import { DeliveriesService } from './deliveries/deliveries.service';
import { EmailChannel } from './deliveries/email.channel';

@Module({
  imports: [DatabaseModule],
  controllers: [DeliveriesController],
  providers: [BusPublisher, EmailChannel, DeliveriesService, NotificationConsumer],
})
export class AppModule {}
