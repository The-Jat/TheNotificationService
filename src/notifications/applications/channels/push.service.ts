import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PushService {

  private logger = new Logger(
    PushService.name,
  );

  async send(
    userId: number,
    message: string,
  ) {

    this.logger.log(
      `Push notification sent to user ${userId}`,
    );

    console.log(message);
  }
}