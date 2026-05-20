import { Injectable, Logger } from '@nestjs/common';

import { BaseConsumer } from 'src/core/events/infrastructure/base.consumer';

import { RabbitMQConnection } from 'src/core/events/infrastructure/rabbitmq.connection';
import { NotificationOrchestratorService } from '../applications/orchestrators/notification-orchestrator.service';

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

    private orchestrator: NotificationOrchestratorService,
  ) {
    super(rabbit);
  }

  protected async handle(
    payload: any,
  ): Promise<void> {
    this.logger.log(
      `Processing ${payload.event}`,
    );

    console.log(payload);

    // To test the Dead Letter Queue
    // throw new Error(
    //   'SMTP provider failed',
    // );
    await this.orchestrator.handle(
      payload.event,
      payload.data,
    );
  }
}