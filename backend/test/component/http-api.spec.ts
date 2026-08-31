import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/shared/infrastructure/filters/http-exception.filter';
import { CorrelationIdInterceptor } from '../../src/shared/infrastructure/interceptors/correlation-id.interceptor';
import { USERS_REPOSITORY } from '@modules/auth/application/ports/users.repository';
import { SESSIONS_REPOSITORY } from '@modules/auth/application/ports/sessions.repository';
import { CANDIDATE_PROFILE_REPOSITORY } from '@modules/candidate-profile/application/ports/candidate-profile.repository';
import { PROFILE_IMPORT_ATTEMPTS_REPOSITORY } from '@modules/candidate-profile/application/ports/profile-import-attempts.repository';
import { TENANTS_REPOSITORY } from '@modules/catalog/application/ports/tenants.repository';
import { JOBS_REPOSITORY } from '@modules/catalog/application/ports/jobs.repository';
import { TAILORED_RESUMES_REPOSITORY } from '@modules/resume/application/ports/tailored-resumes.repository';
import { RESUME_ARTIFACTS_REPOSITORY } from '@modules/resume/application/ports/resume-artifacts.repository';
import { JOB_APPLICATIONS_REPOSITORY } from '@modules/applications/application/ports/job-applications.repository';
import { AUTO_APPLY_POLICIES_REPOSITORY } from '@modules/auto-apply/application/ports/auto-apply-policies.repository';
import { AUTO_APPLY_DECISIONS_REPOSITORY } from '@modules/auto-apply/application/ports/auto-apply-decisions.repository';
import { AUDIT_LOGS_REPOSITORY } from '@modules/operations/application/ports/audit-logs.repository';
import { User } from '@modules/auth/domain/user.entity';
import { RefreshSession } from '@modules/auth/domain/refresh-session.entity';
import { CandidateProfile } from '@modules/candidate-profile/domain/candidate-profile.entity';
import { ProfileImportAttempt } from '@modules/candidate-profile/domain/profile-import-attempt.entity';
import { Tenant } from '@modules/catalog/domain/tenant.entity';
import { Job } from '@modules/catalog/domain/job.entity';
import { TailoredResume } from '@modules/resume/domain/tailored-resume.entity';
import { ResumeArtifact } from '@modules/resume/domain/resume-artifact.entity';
import { JobApplication } from '@modules/applications/domain/job-application.entity';
import { AutoApplyPolicy } from '@modules/auto-apply/domain/auto-apply-policy.entity';
import { AutoApplyDecision } from '@modules/auto-apply/domain/auto-apply-decision.entity';
import { AuditLog } from '@modules/operations/domain/audit-log.entity';

describe('HTTP API End-to-End Component Tests', () => {
  let app: INestApplication;

  const usersMap = new Map<string, User>();
  const sessionsMap = new Map<string, RefreshSession>();
  const profilesMap = new Map<string, CandidateProfile>();
  const importAttemptsMap = new Map<string, ProfileImportAttempt>();
  const tenantsMap = new Map<string, Tenant>();
  const jobsMap = new Map<string, Job>();
  const resumesMap = new Map<string, TailoredResume>();
  const artifactsMap = new Map<string, ResumeArtifact>();
  const appsMap = new Map<string, JobApplication>();
  const policiesMap = new Map<string, AutoApplyPolicy>();
  const decisionsMap = new Map<string, AutoApplyDecision>();
  const auditLogs: AuditLog[] = [];

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(USERS_REPOSITORY)
      .useValue({
        findById: async (id: string) => usersMap.get(id) || null,
        findByEmail: async (email: string) => {
          for (const u of usersMap.values()) if (u.email === email.toLowerCase().trim()) return u;
          return null;
        },
        create: async (u: User) => { usersMap.set(u.id, u); return u; },
      })
      .overrideProvider(SESSIONS_REPOSITORY)
      .useValue({
        create: async (s: RefreshSession) => { sessionsMap.set(s.id, s); return s; },
        findByTokenHash: async (hash: string) => {
          for (const s of sessionsMap.values()) if (s.tokenHash === hash) return s;
          return null;
        },
        revoke: async (id: string, now: Date) => {
          const s = sessionsMap.get(id);
          if (s) s.revoke(now);
        },
        revokeAllForUser: async (userId: string, now: Date) => {
          for (const s of sessionsMap.values()) if (s.userId === userId) s.revoke(now);
        },
      })
      .overrideProvider(CANDIDATE_PROFILE_REPOSITORY)
      .useValue({
        findByUserId: async (userId: string) => profilesMap.get(userId) || null,
        save: async (p: CandidateProfile) => { profilesMap.set(p.userId, p); return p; },
      })
      .overrideProvider(PROFILE_IMPORT_ATTEMPTS_REPOSITORY)
      .useValue({
        findById: async (id: string) => importAttemptsMap.get(id) || null,
        save: async (a: ProfileImportAttempt) => { importAttemptsMap.set(a.id, a); return a; },
      })
      .overrideProvider(TENANTS_REPOSITORY)
      .useValue({
        findById: async (id: string) => tenantsMap.get(id) || null,
        findBySlug: async (slug: string) => {
          for (const t of tenantsMap.values()) if (t.slug === slug.toLowerCase()) return t;
          return null;
        },
        findAll: async () => ({ items: Array.from(tenantsMap.values()), total: tenantsMap.size }),
        save: async (t: Tenant) => { tenantsMap.set(t.id, t); return t; },
      })
      .overrideProvider(JOBS_REPOSITORY)
      .useValue({
        findById: async (id: string) => jobsMap.get(id) || null,
        findByTenantAndExternalId: async (tenantId: string, extId: string) => {
          for (const j of jobsMap.values()) if (j.tenantId === tenantId && j.externalId === extId) return j;
          return null;
        },
        findAll: async () => ({ items: Array.from(jobsMap.values()), total: jobsMap.size }),
        findByTenantId: async (tenantId: string) => Array.from(jobsMap.values()).filter((j) => j.tenantId === tenantId),
        save: async (j: Job) => { jobsMap.set(j.id, j); return j; },
      })
      .overrideProvider(TAILORED_RESUMES_REPOSITORY)
      .useValue({
        findById: async (id: string) => resumesMap.get(id) || null,
        findByVersions: async (userId: string, jobId: string, pv: number, jv: number, tv: number) => {
          for (const r of resumesMap.values()) {
            if (r.userId === userId && r.jobId === jobId && r.profileVersion === pv && r.jobVersion === jv && r.templateVersion === tv) return r;
          }
          return null;
        },
        findLatestByJobAndUser: async (userId: string, jobId: string) => {
          for (const r of resumesMap.values()) if (r.userId === userId && r.jobId === jobId) return r;
          return null;
        },
        save: async (r: TailoredResume) => { resumesMap.set(r.id, r); return r; },
        addAttempt: async () => {},
      })
      .overrideProvider(RESUME_ARTIFACTS_REPOSITORY)
      .useValue({
        findById: async (id: string) => artifactsMap.get(id) || null,
        save: async (a: ResumeArtifact) => { artifactsMap.set(a.id, a); return a; },
      })
      .overrideProvider(JOB_APPLICATIONS_REPOSITORY)
      .useValue({
        findById: async (id: string) => appsMap.get(id) || null,
        findByUserAndJob: async (userId: string, jobId: string) => {
          for (const a of appsMap.values()) if (a.userId === userId && a.jobId === jobId) return a;
          return null;
        },
        findAll: async () => ({ items: Array.from(appsMap.values()), total: appsMap.size }),
        findStuckProcessing: async () => [],
        findQueuedWithoutJob: async () => Array.from(appsMap.values()).filter((a) => a.status === 'QUEUED'),
        save: async (a: JobApplication) => { appsMap.set(a.id, a); return a; },
        addAttempt: async () => {},
        saveReceipt: async () => {},
      })
      .overrideProvider(AUTO_APPLY_POLICIES_REPOSITORY)
      .useValue({
        findByUserId: async (userId: string) => policiesMap.get(userId) || null,
        save: async (p: AutoApplyPolicy) => { policiesMap.set(p.userId, p); return p; },
      })
      .overrideProvider(AUTO_APPLY_DECISIONS_REPOSITORY)
      .useValue({
        countAcceptedForDate: async () => 0,
        findByUserAndDate: async () => [],
        findByUserAndJob: async () => null,
        save: async (d: AutoApplyDecision) => { decisionsMap.set(d.id, d); return d; },
      })
      .overrideProvider(AUDIT_LOGS_REPOSITORY)
      .useValue({
        save: async (l: AuditLog) => { auditLogs.push(l); return l; },
        findAll: async () => ({ items: auditLogs, total: auditLogs.length }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new CorrelationIdInterceptor());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  let candidateToken: string;
  let adminToken: string;

  it('1. Register Candidate and Admin', async () => {
    const candidateRes = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: 'candidate@inhire.internal', password: 'Password123!', role: 'CANDIDATE' })
      .expect(201);

    expect(candidateRes.body.accessToken).toBeDefined();
    candidateToken = candidateRes.body.accessToken;

    const adminRes = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: 'admin@inhire.internal', password: 'AdminPassword123!', role: 'ADMIN' })
      .expect(201);

    expect(adminRes.body.accessToken).toBeDefined();
    adminToken = adminRes.body.accessToken;
  });

  it('2. Candidate Profile lifecycle', async () => {
    // Before creating profile, GET /v1/me/profile returns 404 with PROFILE_NOT_STARTED
    const notStartedRes = await request(app.getHttpServer())
      .get('/v1/me/profile')
      .set('Authorization', `Bearer ${candidateToken}`)
      .expect(404);

    expect(notStartedRes.body.code).toBe('PROFILE_NOT_STARTED');

    // Create profile
    const putRes = await request(app.getHttpServer())
      .put('/v1/me/profile')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({
        fullName: 'Jane Doe',
        email: 'jane@inhire.internal',
        phone: '+55 11 91234-5678',
        location: { country: 'Brazil', city: 'São Paulo' },
        skills: ['TypeScript', 'NestJS', 'PostgreSQL'],
        experiences: [{ company: 'InHire', role: 'Fullstack Dev' }],
      })
      .expect(200);

    expect(putRes.body.fullName).toBe('Jane Doe');
    expect(putRes.body.version).toBe(2);

    // Readiness check
    const readinessRes = await request(app.getHttpServer())
      .get('/v1/me/profile/readiness?purpose=SUBMISSION')
      .set('Authorization', `Bearer ${candidateToken}`)
      .expect(200);

    expect(readinessRes.body.ready).toBe(true);
  });

  let publishedJobId: string;

  it('3. Admin publishes Tenant and Job in Catalog', async () => {
    const tenantRes = await request(app.getHttpServer())
      .post('/v1/admin/tenants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        slug: 'acme-corp',
        name: 'ACME Corp',
        officialUrl: 'https://acme.inhire.app/jobs',
      })
      .expect(201);

    const tenantId = tenantRes.body.id;

    const jobRes = await request(app.getHttpServer())
      .post('/v1/admin/jobs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        tenantId,
        externalId: 'job-999',
        title: 'Senior Backend Engineer',
        url: 'https://acme.inhire.app/jobs/job-999', // Canonical Job URL
        description: 'Clean Architecture with TypeScript and NestJS',
        location: 'São Paulo, SP',
      })
      .expect(201);

    publishedJobId = jobRes.body.id;

    // Public catalog query returns exact url
    const publicJob = await request(app.getHttpServer())
      .get(`/v1/jobs/${publishedJobId}`)
      .expect(200);

    expect(publicJob.body.url).toBe('https://acme.inhire.app/jobs/job-999');
  });

  it('4. Candidate applies to Job (202 Accepted)', async () => {
    const applyRes = await request(app.getHttpServer())
      .post(`/v1/jobs/${publishedJobId}/applications`)
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({
        resumeMode: 'AI_TAILORED',
      });

    if (applyRes.status !== 202) {
      // eslint-disable-next-line no-console
      console.error('Apply error detail:', applyRes.body);
    }

    expect(applyRes.status).toBe(202);
    expect(applyRes.body.status).toBe('QUEUED');
    expect(applyRes.body.location).toBeDefined();

    // Query application
    const appRes = await request(app.getHttpServer())
      .get(applyRes.body.location)
      .set('Authorization', `Bearer ${candidateToken}`)
      .expect(200);

    expect(appRes.body.jobUrl).toBe('https://acme.inhire.app/jobs/job-999');
  });

  it('5. Health liveness and readiness endpoints', async () => {
    const liveRes = await request(app.getHttpServer())
      .get('/health/live')
      .expect(200);

    expect(liveRes.body.isLive).toBe(true);
  });
});
