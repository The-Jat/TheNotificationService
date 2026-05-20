import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';

import amqp, {
  Channel,
  ChannelModel,
} from 'amqplib';
import { DLX } from './constants';

@Injectable()
export class RabbitMQConnection
  implements OnModuleInit
{
  private readonly logger =
    new Logger(
      RabbitMQConnection.name,
    );

  private connection: ChannelModel;

  private channel: Channel;

  async onModuleInit() {

    /**
     * CONNECT TO RABBITMQ
     */
    this.connection =
      await amqp.connect(
        process.env.RABBITMQ_URL ||
          'amqp://localhost:5672',
      );

    /**
     * CREATE CHANNEL
     */
    this.channel =
      await this.connection.createChannel();

    /**
     * DOMAIN EVENTS EXCHANGE
     */
    await this.channel.assertExchange(
      'domain.events',
      'topic',
      {
        durable: true,
      },
    );

    /**
     * DEAD LETTER EXCHANGE
     */
    await this.channel.assertExchange(
      DLX,
      'topic',
      {
        durable: true,
      },
    );

    console.log(
      '✅ RabbitMQ connected',
    );

    /**
     * CONNECTION CLOSED
     */
    this.connection.on(
      'close',
      () => {
        this.logger.error(
          'RabbitMQ connection closed',
        );
      },
    );

    /**
     * CONNECTION ERROR
     */
    this.connection.on(
      'error',
      (err) => {
        this.logger.error(
          `RabbitMQ error: ${err.message}`,
        );
      },
    );

  }

  getChannel() {
    return this.channel;
  }
}