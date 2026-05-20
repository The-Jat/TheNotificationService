import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsService {

  private logger = new Logger(
    SmsService.name,
  );

  async send(
    phone: string,
    message: string,
  ) {

    this.logger.log(
      `SMS sent to ${phone}`,
    );

    console.log(message);
  }
}