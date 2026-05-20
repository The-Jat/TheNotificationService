import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WebhookService {

  private logger = new Logger(
    WebhookService.name,
  );

  async send(
    url: string,
    payload: any,
  ) {

    this.logger.log(
      `Webhook triggered: ${url}`,
    );

    console.log(payload);
  }
}