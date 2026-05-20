import { Injectable, Logger } from '@nestjs/common';

import { BaseConsumer } from 'src/core/events/infrastructure/base.consumer';

import { RabbitMQConnection } from 'src/core/events/infrastructure/rabbitmq.connection';

@Injectable()
export class UserCreatedConsumer
  extends BaseConsumer {
  protected consumerName =
    'UserCreatedConsumer';

  protected queue =
    'notification.user.created';

  protected routingKeys = [
    'auth.user.created',
  ];

  protected logger = new Logger(
    UserCreatedConsumer.name,
  );

  constructor(
    rabbit: RabbitMQConnection,
  ) {
    super(rabbit);
  }

  protected async handle(
    payload: any,
  ): Promise<void> {
    this.logger.log(
      '📧 WELCOME EMAIL EVENT RECEIVED IN NOTIFICATION SERVICE',
    );

    // To test the Dead Letter Queue
    // throw new Error(
    //   'SMTP provider failed',
    // );

    console.log(payload);
  }
}