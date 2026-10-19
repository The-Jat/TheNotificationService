import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import amqp, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';
import { randomUUID } from 'crypto';
import { config } from '../config';
import { DOMAIN_EXCHANGE } from './consumer';

@Injectable()
export class BusPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BusPublisher.name);
  private connection?: AmqpConnectionManager;
  private channel?: ChannelWrapper;

  onModuleInit() {
    this.connection = amqp.connect([config.rabbitmqUrl]);
    this.channel = this.connection.createChannel({
      setup: (ch: ConfirmChannel) => ch.assertExchange(DOMAIN_EXCHANGE, 'topic', { durable: true }),
    });
  }

  async onModuleDestroy() {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  publish(event: string, data: Record<string, unknown>, correlationId?: string) {
    const envelope = { id: randomUUID(), event, version: 1, occurredAt: new Date().toISOString(), service: 'notification-service', correlationId, data };
    this.channel
      ?.publish(DOMAIN_EXCHANGE, event, Buffer.from(JSON.stringify(envelope)), { persistent: true, contentType: 'application/json', timeout: 5000 })
      .catch((err) => this.logger.error(`Failed to publish ${event}: ${err.message}`));
  }
}
