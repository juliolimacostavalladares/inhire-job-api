import { CandidateProfile } from '@modules/candidate-profile/domain/candidate-profile.entity';
import { CandidateProfileRepository } from '@modules/candidate-profile/application/ports/candidate-profile.repository';
import { ProfileImportAttemptsRepository } from '@modules/candidate-profile/application/ports/profile-import-attempts.repository';
import { ProfileImportAttempt } from '@modules/candidate-profile/domain/profile-import-attempt.entity';
import { GetProfileUseCase } from '@modules/candidate-profile/application/use-cases/get-profile.use-case';
import { ImportProfileUseCase } from '@modules/candidate-profile/application/use-cases/import-profile.use-case';
import { InMemoryArtifactStorage } from '@shared/infrastructure/storage/in-memory-artifact-storage';
import { BullMQService } from '@shared/infrastructure/bullmq/bullmq.service';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';
import { FakeClock } from '@shared/infrastructure/clock/fake-clock';
import { UuidGenerator } from '@shared/infrastructure/id-generator/uuid-generator';
import { AppError } from '@shared/domain/errors/app-error';

class InMemoryCandidateProfileRepo implements CandidateProfileRepository {
  private profiles = new Map<string, CandidateProfile>();
  async findByUserId(userId: string): Promise<CandidateProfile | null> {
    return this.profiles.get(userId) || null;
  }
  async save(profile: CandidateProfile): Promise<CandidateProfile> {
    this.profiles.set(profile.userId, profile);
    return profile;
  }
}

class InMemoryImportAttemptsRepo implements ProfileImportAttemptsRepository {
  private attempts = new Map<string, ProfileImportAttempt>();
  async findById(id: string): Promise<ProfileImportAttempt | null> {
    return this.attempts.get(id) || null;
  }
  async save(attempt: ProfileImportAttempt): Promise<ProfileImportAttempt> {
    this.attempts.set(attempt.id, attempt);
    return attempt;
  }
}

describe('Candidate Profile Module - Unit Tests (CAND-AC-03..05)', () => {
  let profileRepo: InMemoryCandidateProfileRepo;
  let attemptsRepo: InMemoryImportAttemptsRepo;
  let storage: InMemoryArtifactStorage;
  let bullmq: BullMQService;
  let clock: FakeClock;
  let idGen: UuidGenerator;
  let getProfileUseCase: GetProfileUseCase;
  let importUseCase: ImportProfileUseCase;

  beforeEach(() => {
    profileRepo = new InMemoryCandidateProfileRepo();
    attemptsRepo = new InMemoryImportAttemptsRepo();
    storage = new InMemoryArtifactStorage();
    bullmq = new BullMQService(new SanitizedLogger());
    clock = new FakeClock(new Date('2026-08-31T10:00:00.000Z'));
    idGen = new UuidGenerator();

    getProfileUseCase = new GetProfileUseCase(profileRepo);
    importUseCase = new ImportProfileUseCase(attemptsRepo, storage, bullmq, idGen, clock);
  });

  it('CAND-FR-05: Absence of profile returns PROFILE_NOT_STARTED, not FAILED', async () => {
    await expect(getProfileUseCase.execute('uninitialized-user-id'))
      .rejects.toThrow('Candidate profile not created yet');
  });

  it('CAND-AC-03: Invalid PDF is rejected before AI', async () => {
    const invalidBuffer = Buffer.from('This is not a PDF file at all');
    await expect(importUseCase.execute('user-1', invalidBuffer, 'application/pdf'))
      .rejects.toThrow('Uploaded file must be a valid PDF');
  });

  it('CAND-AC-04: Missing required fields block submission or tailored resume with objective list', () => {
    const profile = CandidateProfile.create({
      id: 'profile-1',
      userId: 'user-1',
      fullName: 'Alice Developer',
      email: 'alice@inhire.internal',
    });

    // Incomplete for submission (missing phone, location, experience)
    const submissionReadiness = profile.assessReadiness('SUBMISSION');
    expect(submissionReadiness.ready).toBe(false);
    expect(submissionReadiness.missingFields).toContain('phone');
    expect(submissionReadiness.missingFields).toContain('location.country');

    // Update with required fields
    profile.update({
      phone: '+55 11 99999-9999',
      location: { country: 'Brazil', city: 'São Paulo' },
      experiences: [{ company: 'Tech Inc', role: 'Software Engineer' }],
      skills: ['TypeScript', 'Node.js'],
    });

    const readyAssessment = profile.assessReadiness('SUBMISSION');
    expect(readyAssessment.ready).toBe(true);
    expect(readyAssessment.missingFields).toHaveLength(0);
  });

  it('CAND-AC-05: Repeating preparation produces deterministic application snapshot', () => {
    const profile = CandidateProfile.create({
      id: 'profile-1',
      userId: 'user-1',
      fullName: 'Bob Smith',
      email: 'bob@inhire.internal',
    });
    profile.update({
      phone: '+55 11 98888-8888',
      location: { country: 'Brazil', city: 'Campinas' },
    });

    const snap1 = profile.prepareApplicationData(['fullName', 'email', 'phone', 'country', 'city']);
    const snap2 = profile.prepareApplicationData(['fullName', 'email', 'phone', 'country', 'city']);

    expect(snap1).toEqual(snap2);
    expect(snap1).toEqual({
      fullName: 'Bob Smith',
      email: 'bob@inhire.internal',
      phone: '+55 11 98888-8888',
      country: 'Brazil',
      city: 'Campinas',
    });
  });
});
