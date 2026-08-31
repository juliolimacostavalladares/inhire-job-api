import { Injectable, Inject } from '@nestjs/common';
import { CANDIDATE_PROFILE_REPOSITORY, CandidateProfileRepository } from '../ports/candidate-profile.repository';
import { CandidateProfile, LocationInfo, ExperienceInfo, EducationInfo } from '../../domain/candidate-profile.entity';
import { ID_GENERATOR_PORT, IdGenerator } from '@shared/domain/ports/id-generator.port';
import { CLOCK_PORT, Clock } from '@shared/domain/ports/clock.port';

export interface UpdateProfileDto {
  fullName?: string;
  headline?: string;
  email?: string;
  phone?: string;
  location?: LocationInfo;
  experiences?: ExperienceInfo[];
  education?: EducationInfo[];
  skills?: string[];
  expectedVersion?: number;
}

@Injectable()
export class UpdateProfileUseCase {
  constructor(
    @Inject(CANDIDATE_PROFILE_REPOSITORY) private readonly profileRepo: CandidateProfileRepository,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGenerator,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
  ) {}

  async execute(userId: string, dto: UpdateProfileDto): Promise<CandidateProfile> {
    let profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      profile = CandidateProfile.create({
        id: this.idGenerator.generate(),
        userId,
        email: dto.email,
        fullName: dto.fullName,
        now: this.clock.now(),
      });
    }

    profile.update(
      {
        fullName: dto.fullName,
        headline: dto.headline,
        email: dto.email,
        phone: dto.phone,
        location: dto.location,
        experiences: dto.experiences,
        education: dto.education,
        skills: dto.skills,
        status: 'COMPLETE',
      },
      dto.expectedVersion,
    );

    return this.profileRepo.save(profile);
  }
}
