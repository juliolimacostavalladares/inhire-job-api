import { Controller, Post, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { RetryApplicationUseCase } from '../application/use-cases/application-use-cases';

@Controller('v1/admin/applications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminApplicationsController {
  constructor(private readonly retryApplicationUseCase: RetryApplicationUseCase) {}

  @Post(':id/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  async retryApplication(@Param('id') id: string, @Body() body: { reason: string }) {
    return this.retryApplicationUseCase.execute(id, body?.reason || 'Admin retry');
  }
}
