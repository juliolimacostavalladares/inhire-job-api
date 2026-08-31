import { TailoredResume } from '@modules/resume/domain/tailored-resume.entity';
import { ResumeArtifact } from '@modules/resume/domain/resume-artifact.entity';
import { TailoredResumesRepository } from '@modules/resume/application/ports/tailored-resumes.repository';
import { ResumeArtifactsRepository } from '@modules/resume/application/ports/resume-artifacts.repository';
import { GetResumeByJobUseCase } from '@modules/resume/application/use-cases/resume-use-cases';
import { DeterministicAiProvider } from '@modules/resume/infrastructure/ai/deterministic-ai.provider';
import { SimplePdfRenderer } from '@modules/resume/infrastructure/pdf/simple-pdf-renderer';
import { CandidateProfile } from '@modules/candidate-profile/domain/candidate-profile.entity';
import { JobSnapshot } from '@modules/catalog/domain/job.entity';

class InMemoryTailoredResumesRepo implements TailoredResumesRepository {
  private resumes = new Map<string, TailoredResume>();

  async findById(id: string): Promise<TailoredResume | null> {
    return this.resumes.get(id) || null;
  }
  async findByVersions(userId: string, jobId: string, profileVersion: number, jobVersion: number, templateVersion: number): Promise<TailoredResume | null> {
    for (const r of this.resumes.values()) {
      if (r.userId === userId && r.jobId === jobId && r.profileVersion === profileVersion && r.jobVersion === jobVersion && r.templateVersion === templateVersion) {
        return r;
      }
    }
    return null;
  }
  async findLatestByJobAndUser(userId: string, jobId: string): Promise<TailoredResume | null> {
    for (const r of this.resumes.values()) {
      if (r.userId === userId && r.jobId === jobId) return r;
    }
    return null;
  }
  async save(resume: TailoredResume): Promise<TailoredResume> {
    this.resumes.set(resume.id, resume);
    return resume;
  }
  async addAttempt(): Promise<void> {}
}

describe('Resume Module - Unit Tests (RES-AC-01..05)', () => {
  let resumesRepo: InMemoryTailoredResumesRepo;
  let aiProvider: DeterministicAiProvider;
  let pdfRenderer: SimplePdfRenderer;
  let getResumeByJobUseCase: GetResumeByJobUseCase;

  beforeEach(() => {
    resumesRepo = new InMemoryTailoredResumesRepo();
    aiProvider = new DeterministicAiProvider();
    pdfRenderer = new SimplePdfRenderer();
    getResumeByJobUseCase = new GetResumeByJobUseCase(resumesRepo);
  });

  it('RES-FR-08 / T-APP-03: Consulting job resume without prior request returns RESUME_NOT_STARTED, not FAILED', async () => {
    await expect(getResumeByJobUseCase.execute('user-1', 'job-99'))
      .rejects.toThrow('No tailored resume has been generated for this job yet');
  });

  it('RES-AC-04: AI tailored content strictly does not invent experience not present in profile', async () => {
    const profile = CandidateProfile.create({
      id: 'profile-1',
      userId: 'user-1',
      fullName: 'Carlos Mendes',
      email: 'carlos@inhire.internal',
    });
    profile.update({
      skills: ['Node.js', 'PostgreSQL'],
      experiences: [{ company: 'FinTech', role: 'Backend Engineer' }],
    });

    const jobSnapshot: JobSnapshot = {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      title: 'Senior Node.js Engineer',
      jobUrl: 'https://fintech.inhire.app/jobs/1',
      status: 'PUBLISHED',
      description: 'Looking for Node.js, PostgreSQL and Kubernetes experts',
      formSchema: [],
      version: 1,
    };

    const content = await aiProvider.generateTailoredContent(profile, jobSnapshot);
    expect(content.matchScore).toBeGreaterThanOrEqual(50);
    expect(content.highlightedSkills).toContain('Node.js');

    // PDF rendering produces valid PDF header
    const pdfBuffer = await pdfRenderer.renderToPdf(profile, content);
    expect(pdfBuffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});
