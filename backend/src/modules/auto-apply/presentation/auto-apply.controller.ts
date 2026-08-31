import { Controller, Get, Put, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/application/ports/token-service.port';
import {
  GetPolicyUseCase,
  UpdatePolicyUseCase,
  ListDecisionsUseCase,
} from '../application/use-cases/auto-apply-use-cases';
import { IdempotencyGuard } from '@shared/infrastructure/guards/idempotency.guard';

@Controller('v1/me')
@UseGuards(JwtAuthGuard)
export class AutoApplyController {
  constructor(
    private readonly getPolicyUseCase: GetPolicyUseCase,
    private readonly updatePolicyUseCase: UpdatePolicyUseCase,
    private readonly listDecisionsUseCase: ListDecisionsUseCase,
  ) {}

  @Get('auto-apply-policy')
  @HttpCode(HttpStatus.OK)
  async getPolicy(@CurrentUser() user: JwtPayload) {
    const policy = await this.getPolicyUseCase.execute(user.sub);
    return {
      id: policy.id,
      userId: policy.userId,
      enabled: policy.enabled,
      minScore: policy.minScore,
      dailyLimit: policy.dailyLimit,
      timezone: policy.timezone,
      targetRoles: policy.targetRoles,
      targetLocations: policy.targetLocations,
      version: policy.version,
      updatedAt: policy.updatedAt,
    };
  }

  @Put('auto-apply-policy')
  @UseGuards(IdempotencyGuard)
  @HttpCode(HttpStatus.OK)
  async updatePolicy(
    @CurrentUser() user: JwtPayload,
    @Body() body: {
      enabled?: boolean;
      minScore?: number;
      dailyLimit?: number;
      timezone?: string;
      targetRoles?: string[];
      targetLocations?: string[];
    },
  ) {
    const policy = await this.updatePolicyUseCase.execute(user.sub, body);
    return {
      id: policy.id,
      userId: policy.userId,
      enabled: policy.enabled,
      minScore: policy.minScore,
      dailyLimit: policy.dailyLimit,
      timezone: policy.timezone,
      targetRoles: policy.targetRoles,
      targetLocations: policy.targetLocations,
      version: policy.version,
      updatedAt: policy.updatedAt,
    };
  }

  @Get('auto-apply-decisions')
  @HttpCode(HttpStatus.OK)
  async listDecisions(@CurrentUser() user: JwtPayload, @Query('date') date?: string) {
    return this.listDecisionsUseCase.execute(user.sub, date);
  }
}
