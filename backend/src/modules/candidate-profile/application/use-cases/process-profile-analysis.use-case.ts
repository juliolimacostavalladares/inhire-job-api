import { Injectable, Inject } from '@nestjs/common';
import { CANDIDATE_PROFILE_REPOSITORY, CandidateProfileRepository } from '../ports/candidate-profile.repository';
import { PROFILE_IMPORT_ATTEMPTS_REPOSITORY, ProfileImportAttemptsRepository } from '../ports/profile-import-attempts.repository';
import { PROFILE_AI_EXTRACTOR, ProfileAiExtractor } from '../ports/profile-ai-extractor.port';
import { ARTIFACT_STORAGE_PORT, ArtifactStorage } from '@shared/infrastructure/storage/artifact-storage.port';
import { CandidateProfile } from '../../domain/candidate-profile.entity';
import { ID_GENERATOR_PORT, IdGenerator } from '@shared/domain/ports/id-generator.port';
import { CLOCK_PORT, Clock } from '@shared/domain/ports/clock.port';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';
import { PDFParse } from 'pdf-parse';

@Injectable()
export class ProcessProfileAnalysisUseCase {
  constructor(
    @Inject(CANDIDATE_PROFILE_REPOSITORY) private readonly profileRepo: CandidateProfileRepository,
    @Inject(PROFILE_IMPORT_ATTEMPTS_REPOSITORY) private readonly attemptsRepo: ProfileImportAttemptsRepository,
    @Inject(PROFILE_AI_EXTRACTOR) private readonly aiExtractor: ProfileAiExtractor,
    @Inject(ARTIFACT_STORAGE_PORT) private readonly storage: ArtifactStorage,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGenerator,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
    private readonly logger: SanitizedLogger,
  ) {}

  async execute(importId: string, userId: string): Promise<void> {
    const attempt = await this.attemptsRepo.findById(importId);
    if (!attempt || attempt.status === 'COMPLETED') {
      return; // Idempotent
    }

    try {
      let profile = await this.profileRepo.findByUserId(userId);
      if (!profile) {
        profile = CandidateProfile.create({
          id: this.idGenerator.generate(),
          userId,
          now: this.clock.now(),
        });
      }

      // 1. Download raw PDF artifact from storage
      const storageKey = attempt.rawArtifactId || `profiles/${userId}/${importId}.pdf`;
      const pdfBuffer = await this.storage.download(storageKey);

      // 2. Extract textual content from the PDF
      let resumeText = '';
      try {
        const parser = new PDFParse({ data: pdfBuffer });
        const parsed = (await parser.getText()) as unknown as { text?: string } | string;
        resumeText = (typeof parsed === 'string' ? parsed : parsed?.text) || '';
      } catch (pdfErr) {
        resumeText = pdfBuffer.toString('utf-8');
      }

      // 3. AI extraction of structured candidate profile attributes and search terms
      const extracted = await this.aiExtractor.extractFromResumeText(resumeText);

      const candidateSearchTerms = extracted.searchTerms && extracted.searchTerms.length > 0
        ? extracted.searchTerms
        : [
            ...(extracted.headline ? extracted.headline.split(/[,|/•-]/).map((s) => s.trim()) : []),
            ...(extracted.skills || []),
            ...(extracted.experiences || []).map((e) => e.role),
          ].filter(Boolean);

      // 4. Update candidate profile with all extracted attributes
      profile.update({
        rawResumeArtifactId: storageKey,
        fullName: extracted.fullName || profile.fullName,
        headline: extracted.headline || profile.headline,
        email: extracted.email || profile.email,
        phone: extracted.phone || profile.phone,
        location: extracted.location || profile.location,
        skills: extracted.skills && extracted.skills.length > 0 ? extracted.skills : profile.skills,
        searchTerms: candidateSearchTerms.length > 0 ? candidateSearchTerms : profile.searchTerms,
        experiences: extracted.experiences && extracted.experiences.length > 0 ? extracted.experiences : profile.experiences,
        education: extracted.education && extracted.education.length > 0 ? extracted.education : profile.education,
      });

      // 5. Evaluate readiness for submissions and auto-apply
      const readiness = profile.assessReadiness('SUBMISSION');
      profile.update({
        status: readiness.ready ? 'COMPLETE' : 'NEEDS_REVIEW',
      });

      await this.profileRepo.save(profile);
      attempt.markCompleted(this.clock.now());
      await this.attemptsRepo.save(attempt);

      this.logger.log({
        operation: 'profile_analysis_completed',
        importId,
        userId,
        searchTermsCount: candidateSearchTerms.length,
        isReady: readiness.ready,
        missingFields: readiness.missingFields,
      }, 'ProcessProfileAnalysisUseCase');
    } catch (err: unknown) {
      const error = err as Error;
      attempt.markFailed('EXTRACTION_FAILED', error.message, this.clock.now());
      await this.attemptsRepo.save(attempt);
      throw err;
    }
  }
}
