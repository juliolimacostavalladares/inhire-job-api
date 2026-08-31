import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { CheckHealthUseCase } from '../application/use-cases/operations-use-cases';

@Controller('health')
export class HealthController {
  constructor(private readonly checkHealthUseCase: CheckHealthUseCase) {}

  @Get('live')
  @HttpCode(HttpStatus.OK)
  getLiveness() {
    return this.checkHealthUseCase.getLiveness();
  }

  @Get('ready')
  async getReadiness(@Res() res: Response) {
    const health = await this.checkHealthUseCase.getReadiness();
    if (!health.isReady) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json(health);
    }
    return res.status(HttpStatus.OK).json(health);
  }
}
