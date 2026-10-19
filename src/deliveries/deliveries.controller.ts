import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  HttpCode,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import type { ConsumeMessage } from 'amqplib';
import { config } from '../config';
import { BusConsumer, type DomainEvent } from '../bus/consumer';
import { DatabaseService } from '../database/database.service';
import { DeliveriesService, SUBSCRIBED_EVENTS } from './deliveries.service';

@Injectable()
export class InternalKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const given = Buffer.from(ctx.switchToHttp().getRequest<Request>().header('x-internal-key') ?? '');
    const expected = Buffer.from(config.internalApiKey);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new UnauthorizedException();
    return true;
  }
}

@Injectable()
export class NotificationConsumer extends BusConsumer {
  protected readonly queue = 'notifier.events';
  protected readonly bindings = SUBSCRIBED_EVENTS;
  protected readonly prefetch = 5;

  constructor(private readonly deliveries: DeliveriesService) {
    super(config.rabbitmqUrl);
  }

  protected handle(event: DomainEvent, _raw: ConsumeMessage) {
    return this.deliveries.handleEvent(event);
  }
}

@Controller()
export class DeliveriesController {
  constructor(
    private readonly deliveries: DeliveriesService,
    private readonly db: DatabaseService,
  ) {}

  @Get('health')
  async health() {
    await this.db.query('SELECT 1');
    return { status: 'ok', service: 'notification-service' };
  }

  @Get('internal/deliveries')
  @UseGuards(InternalKeyGuard)
  list(@Query() q: Record<string, string>) {
    return this.deliveries.list(q);
  }

  @Get('internal/stats')
  @UseGuards(InternalKeyGuard)
  stats() {
    return this.deliveries.stats();
  }

  @Post('internal/deliveries/:id/retry')
  @HttpCode(200)
  @UseGuards(InternalKeyGuard)
  retry(@Param('id', ParseUUIDPipe) id: string) {
    return this.deliveries.retry(id);
  }

  @Post('internal/test-email')
  @HttpCode(200)
  @UseGuards(InternalKeyGuard)
  test(@Body() body: { to?: string }) {
    if (!body?.to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.to)) throw new UnauthorizedException('A valid "to" address is required.');
    return this.deliveries.sendTest(body.to);
  }
}
