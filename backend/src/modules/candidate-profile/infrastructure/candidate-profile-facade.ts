import { Injectable, Inject } from '@nestjs/common';
import { CandidateProfileService } from '../application/ports/candidate-profile-service.interface';
import { CandidateProfile, ReadinessResult } from '../domain/candidate-profile.entity';
import { GetProfileUseCase } from '../application/use-cases/get-profile.use-case';
import { AssessReadinessUseCase } from '../application/use-cases/assess-readiness.use-case';

@Injectable()
export class CandidateProfileFacade implements CandidateProfileService {
  constructor(
    private readonly getProfileUseCase: GetProfileUseCase,
    private readonly assessReadinessUseCase: AssessReadinessUseCase,
  ) {}

  async getProfile(userId: string): Promise<CandidateProfile> {
    return this.getProfileUseCase.execute(userId);
  }

  async assessReadiness(userId: string, purpose: 'SUBMISSION' | 'TAILORED_RESUME'): Promise<ReadinessResult> {
    return this.assessReadinessUseCase.execute(userId, purpose);
  }

  async prepareApplicationData(userId: string, requiredFields: string[]): Promise<{ data: Record<string, unknown>; profileVersion: number }> {
    const profile = await this.getProfileUseCase.execute(userId);
    const data = profile.prepareApplicationData(requiredFields);
    return { data, profileVersion: profile.version };
  }
}
