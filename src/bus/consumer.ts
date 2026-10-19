import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import amqp, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';

export const DOMAIN_EXCHANGE = 'domain.events';
export const DEAD_LETTER_EXCHANGE = 'domain.events.dlx';

export interface DomainEvent<T = Record<string, any>> {
  id: string;
  event: string;
  version: number;
  occurredAt: string;
  service: string;
  correlationId?: string;
  data: T;
}

/**
 * Durable topic consumer with a dead-letter queue. A message that throws is
 * rejected without requeue and lands in `<queue>.dlq` for inspection, so one
 * poison message can never block the queue or crash the consumer.
 */
export abstract class BusConsumer implements OnModuleInit, OnModuleDestroy {
  protected abstract readonly queue: string;
  protected abstract readonly bindings: string[];
  protected readonly prefetch: number = 20;
  protected readonly logger = new Logger(this.constructor.name);
  private connection?: AmqpConnectionManager;
  private channel?: ChannelWrapper;

  constructor(private readonly url: string) {}

  protected abstract handle(event: DomainEvent, raw: ConsumeMessage): Promise<void>;

  onModuleInit() {
    this.connection = amqp.connect([this.url]);
    this.connection.on('connect', () => this.logger.log(`Connected; consuming ${this.queue}`));
    this.connection.on('disconnect', ({ err }) => this.logger.warn(`RabbitMQ disconnected: ${err?.message}`));
    this.channel = this.connection.createChannel({
      setup: async (ch: ConfirmChannel) => {
        await ch.assertExchange(DOMAIN_EXCHANGE, 'topic', { durable: true });
        await ch.assertExchange(DEAD_LETTER_EXCHANGE, 'topic', { durable: true });
        await ch.assertQueue(`${this.queue}.dlq`, { durable: true });
        await ch.bindQueue(`${this.queue}.dlq`, DEAD_LETTER_EXCHANGE, this.queue);
        await ch.assertQueue(this.queue, {
          durable: true,
          arguments: { 'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE, 'x-dead-letter-routing-key': this.queue },
        });
        for (const key of this.bindings) await ch.bindQueue(this.queue, DOMAIN_EXCHANGE, key);
        await ch.prefetch(this.prefetch);
        await ch.consume(this.queue, (msg) => msg && this.dispatch(ch, msg));
      },
    });
  }

  async onModuleDestroy() {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  private async dispatch(ch: ConfirmChannel, msg: ConsumeMessage) {
    let event: DomainEvent;
    try {
      event = JSON.parse(msg.content.toString('utf8'));
      if (!event?.event || !event.data) throw new Error('Not a domain event envelope');
    } catch (err) {
      this.logger.error(`Malformed message on ${msg.fields.routingKey}: ${err.message}`);
      return ch.nack(msg, false, false);
    }
    try {
      await this.handle(event, msg);
      ch.ack(msg);
    } catch (err) {
      this.logger.error(`Failed to handle ${event.event} (${event.id}): ${err.message}`);
      ch.nack(msg, false, false);
    }
  }
}
