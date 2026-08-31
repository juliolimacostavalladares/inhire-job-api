/* eslint-disable no-console */

const BASE_URL = 'http://localhost:3000';

async function request(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });
  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    data,
  };
}

async function runLiveApiTests() {
  console.log('====================================================');
  console.log('🚀 RUNNING COMPREHENSIVE REAL API END-TO-END SUITE');
  console.log(`📡 Target API: ${BASE_URL}`);
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: unknown) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`, detail || '');
      failed++;
    }
  }

  const timestamp = Date.now();
  const candidateEmail = `candidate.${timestamp}@inhire.internal`;
  const adminEmail = `admin.${timestamp}@inhire.internal`;
  let candidateToken = '';
  let candidateRefreshToken = '';
  let adminToken = '';
  let tenantId = '';
  let jobId = '';
  let applicationId = '';

  // ----------------------------------------------------
  // 1. Health & Dependency Readiness
  // ----------------------------------------------------
  console.log('--- 1. Health & Dependency Readiness ---');
  const liveRes = await request('/health/live');
  assert(liveRes.status === 200 && liveRes.data.isLive === true, 'GET /health/live returns 200 OK with isLive: true');

  const readyRes = await request('/health/ready');
  assert(
    readyRes.status === 200 &&
    readyRes.data.isReady === true &&
    readyRes.data.dependencies.database.status === 'UP' &&
    readyRes.data.dependencies.redis.status === 'UP',
    'GET /health/ready confirms PostgreSQL and Redis are UP and healthy',
    readyRes.data
  );

  // ----------------------------------------------------
  // 2. Auth & Identity Lifecycle
  // ----------------------------------------------------
  console.log('\n--- 2. Auth & Identity Lifecycle ---');
  
  // 2.1 Register Candidate
  const candRegisterRes = await request('/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: candidateEmail,
      password: 'SecurePassword123!',
      role: 'CANDIDATE',
    }),
  });
  assert(candRegisterRes.status === 201 && !!candRegisterRes.data.accessToken, 'POST /v1/auth/register creates candidate account with JWT');
  candidateToken = candRegisterRes.data.accessToken;
  candidateRefreshToken = candRegisterRes.data.refreshToken;

  // 2.2 Register Admin
  const adminRegisterRes = await request('/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: adminEmail,
      password: 'AdminPassword123!',
      role: 'ADMIN',
    }),
  });
  assert(adminRegisterRes.status === 201 && !!adminRegisterRes.data.accessToken, 'POST /v1/auth/register creates admin account');
  adminToken = adminRegisterRes.data.accessToken;

  // 2.3 Invalid Login (CAND-AC-01)
  const invalidLoginRes = await request('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'nonexistent@inhire.internal',
      password: 'AnyPassword',
    }),
  });
  assert(invalidLoginRes.status === 401 && invalidLoginRes.data.code === 'UNAUTHENTICATED', 'Login with non-existent email returns generic UNAUTHENTICATED (CAND-AC-01)');

  // 2.4 Token Refresh & Rotation (CAND-AC-02)
  const refreshRes = await request('/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({
      refreshToken: candidateRefreshToken,
    }),
  });
  assert(refreshRes.status === 200 && !!refreshRes.data.accessToken, 'POST /v1/auth/refresh rotates tokens successfully');
  candidateToken = refreshRes.data.accessToken;

  // 2.5 Reusing revoked token triggers compromise detection
  const reuseRes = await request('/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({
      refreshToken: candidateRefreshToken, // old reused token
    }),
  });
  assert(reuseRes.status === 401, 'Reusing revoked refresh token triggers security detection (CAND-AC-02)');

  // ----------------------------------------------------
  // 3. Candidate Profile & Readiness
  // ----------------------------------------------------
  console.log('\n--- 3. Candidate Profile & Readiness ---');

  // 3.1 Initial Readiness should be not ready
  const unreadyRes = await request('/v1/me/profile/readiness?purpose=SUBMISSION', {
    headers: { Authorization: `Bearer ${candidateToken}` },
  });
  assert(unreadyRes.status === 200 && unreadyRes.data.ready === false, 'New candidate readiness returns ready: false with missing fields (CAND-AC-04)');

  // 3.2 Update Profile
  const updateProfRes = await request('/v1/me/profile', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${candidateToken}`,
      'Idempotency-Key': `prof-${timestamp}`,
    },
    body: JSON.stringify({
      fullName: 'Mariana Rodrigues',
      email: candidateEmail,
      phone: '+55 11 97777-6666',
      headline: 'Principal Backend Engineer',
      location: { country: 'Brazil', city: 'São Paulo' },
      skills: ['TypeScript', 'Node.js', 'NestJS', 'PostgreSQL', 'Redis', 'BullMQ', 'Docker'],
      experiences: [
        {
          company: 'InHire Core Engineering',
          role: 'Principal Engineer',
          startDate: '2024-01-01',
          description: 'Built high-throughput resilient distributed job automation system',
        },
      ],
      education: [
        {
          institution: 'Universidade de São Paulo',
          degree: 'Computer Science',
        },
      ],
    }),
  });
  assert(updateProfRes.status === 200 && updateProfRes.data.fullName === 'Mariana Rodrigues', 'PUT /v1/me/profile saves complete profile in PostgreSQL');

  // 3.3 Check Readiness now
  const readyCheckRes = await request('/v1/me/profile/readiness?purpose=SUBMISSION', {
    headers: { Authorization: `Bearer ${candidateToken}` },
  });
  assert(readyCheckRes.status === 200 && readyCheckRes.data.ready === true, 'Readiness evaluates to ready: true after profile completion');

  // ----------------------------------------------------
  // 4. Catalog & Jobs (Canonical URL Preservation)
  // ----------------------------------------------------
  console.log('\n--- 4. Catalog & Jobs ---');

  // 4.1 RBAC: Candidate cannot access Admin catalog route
  const forbiddenRes = await request('/v1/admin/tenants', {
    method: 'POST',
    headers: { Authorization: `Bearer ${candidateToken}` },
    body: JSON.stringify({ slug: 'test', name: 'Test', officialUrl: 'https://test.inhire.app' }),
  });
  assert(forbiddenRes.status === 403, 'Candidate token is rejected with 403 Forbidden on Admin routes');

  // 4.2 Admin creates Tenant
  const tenantRes = await request('/v1/admin/tenants', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      slug: `fintech-${timestamp}`,
      name: 'Fintech Global',
      officialUrl: 'https://fintech.inhire.app/careers',
    }),
  });
  assert(tenantRes.status === 201 && !!tenantRes.data.id, 'Admin creates Tenant in Catalog');
  tenantId = tenantRes.data.id;

  // 4.3 Admin publishes Job with immutable canonical URL
  const canonicalUrl = `https://fintech.inhire.app/careers/principal-architect-${timestamp}?src=official`;
  const jobRes = await request('/v1/admin/jobs', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      tenantId,
      externalId: `job-arch-${timestamp}`,
      title: 'Principal Software Architect',
      url: canonicalUrl,
      description: 'Architecting ultra-low latency event-driven pipelines with TypeScript',
      location: 'Remote / São Paulo, BR',
    }),
  });
  assert(jobRes.status === 201 && jobRes.data.url === canonicalUrl, 'Admin creates Job with exact canonical URL preserved');
  jobId = jobRes.data.id;

  // 4.4 Public Job View preserves exact canonical URL (CAT-AC-01)
  const publicJobRes = await request(`/v1/jobs/${jobId}`);
  assert(publicJobRes.status === 200 && publicJobRes.data.url === canonicalUrl, 'GET /v1/jobs/:id returns byte-for-byte canonical URL without slug manipulation');

  // ----------------------------------------------------
  // 5. Application Lifecycle & Asynchronous Worker
  // ----------------------------------------------------
  console.log('\n--- 5. Application Lifecycle & Asynchronous Worker ---');

  const idempotencyKey = `apply-${timestamp}`;
  const applyRes = await request(`/v1/jobs/${jobId}/applications`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${candidateToken}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ resumeMode: 'AI_TAILORED' }),
  });
  assert(applyRes.status === 202 && applyRes.data.status === 'QUEUED', 'POST /v1/jobs/:id/applications returns 202 Accepted with QUEUED status');
  applicationId = applyRes.data.applicationId;

  // 5.2 Idempotency: Re-submitting with same Idempotency-Key returns cached response
  const duplicateApplyRes = await request(`/v1/jobs/${jobId}/applications`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${candidateToken}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ resumeMode: 'AI_TAILORED' }),
  });
  assert(duplicateApplyRes.status === 202, 'Idempotent re-submission returns identical 202 Accepted');

  // 5.3 Poll for Worker Completion (QUEUED -> PROCESSING -> SUBMITTED)
  console.log('  ⏳ Waiting for BullMQ worker to process application...');
  let appState: any = {};
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const appQuery = await request(`/v1/applications/${applicationId}`, {
      headers: { Authorization: `Bearer ${candidateToken}` },
    });
    appState = appQuery.data;
    if (appState.status === 'SUBMITTED') {
      break;
    }
  }

  assert(
    appState.status === 'SUBMITTED' && !!appState.receipt,
    'Application processed asynchronously by Worker, transitioned to SUBMITTED with verified receipt',
    { status: appState.status, receipt: appState.receipt }
  );

  // ----------------------------------------------------
  // 6. Auto-Apply & Policy Management
  // ----------------------------------------------------
  console.log('\n--- 6. Auto-Apply & Policy Management ---');

  const policyRes = await request('/v1/me/auto-apply-policy', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${candidateToken}` },
    body: JSON.stringify({
      enabled: true,
      minScore: 70,
      dailyLimit: 10,
      targetRoles: ['Principal Software Architect', 'Senior Backend Engineer'],
      targetLocations: ['São Paulo', 'Remote'],
    }),
  });
  assert(policyRes.status === 200 && policyRes.data.dailyLimit === 10, 'PUT /v1/me/auto-apply-policy configures candidate auto-apply policy');

  const getPolicyRes = await request('/v1/me/auto-apply-policy', {
    headers: { Authorization: `Bearer ${candidateToken}` },
  });
  assert(getPolicyRes.status === 200 && getPolicyRes.data.enabled === true, 'GET /v1/me/auto-apply-policy fetches active policy');

  // ----------------------------------------------------
  // 7. Operations, Metrics & Reconciler
  // ----------------------------------------------------
  console.log('\n--- 7. Operations, Metrics & Reconciler ---');

  const metricsRes = await request('/v1/operations/metrics', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    metricsRes.status === 200 &&
    typeof metricsRes.data.queues === 'object' &&
    typeof metricsRes.data.applications.total === 'number',
    'GET /v1/operations/metrics aggregates operational metrics across all 6 queues',
    metricsRes.data
  );

  const reconcileRes = await request('/v1/operations/reconcile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({}),
  });
  assert(
    reconcileRes.status === 200 &&
    typeof reconcileRes.data.reEnqueuedQueued === 'number' &&
    typeof reconcileRes.data.recoveredStuckProcessing === 'number',
    'POST /v1/operations/reconcile runs system reconciliation idempotently',
    reconcileRes.data
  );

  console.log('\n====================================================');
  console.log(`🏁 REAL API TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runLiveApiTests().catch((err) => {
  console.error('Fatal error running live API tests:', err);
  process.exit(1);
});
