import { Injectable } from '@nestjs/common';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { OfficialApplicationSubmitter, ApplicationPackage } from '../../application/ports/official-application-submitter.port';
import { SubmissionOutcomeResult } from '../../domain/submission-outcome.vo';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';

@Injectable()
export class PlaywrightApplicationSubmitter implements OfficialApplicationSubmitter {
  constructor(private readonly logger: SanitizedLogger) {}

  async submit(pkg: ApplicationPackage): Promise<SubmissionOutcomeResult> {
    // 1. Validar URL e bloquear hosts não permitidos
    try {
      const url = new URL(pkg.jobUrl);
      const host = url.hostname.toLowerCase();
      const isAllowed = host === 'inhire.app' || host.endsWith('.inhire.app') || host === 'localhost' || host === '127.0.0.1';
      if (url.protocol !== 'https:' && host !== 'localhost' && host !== '127.0.0.1') {
        return {
          outcome: 'PERMANENT_FAILURE',
          errorCode: 'JOB_URL_NOT_ALLOWED',
          errorMessage: 'Job URL must use HTTPS',
        };
      }
      if (!isAllowed) {
        return {
          outcome: 'PERMANENT_FAILURE',
          errorCode: 'JOB_URL_NOT_ALLOWED',
          errorMessage: `Host '${host}' is not in allowlist`,
        };
      }
    } catch {
      return {
        outcome: 'PERMANENT_FAILURE',
        errorCode: 'JOB_URL_NOT_ALLOWED',
        errorMessage: 'Invalid URL format',
      };
    }

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;

    try {
      browser = await chromium.launch({ headless: true });
      context = await browser.newContext({
        userAgent: 'InHire-OfficialSubmitter/1.0',
      });
      const page = await context.newPage();

      // Navigate to canonical URL
      const response = await page.goto(pkg.jobUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });
      if (!response || response.status() >= 400) {
        return {
          outcome: 'MANUAL_ACTION_REQUIRED',
          errorCode: 'EXTERNAL_JOB_CLOSED',
          errorMessage: `Page returned HTTP status ${response?.status() || 'unknown'}`,
        };
      }

      // Check if page indicates closed
      const isClosed = await page.locator('text=/vaga encerrada|job closed/i').count();
      if (isClosed > 0) {
        return {
          outcome: 'MANUAL_ACTION_REQUIRED',
          errorCode: 'EXTERNAL_JOB_CLOSED',
          errorMessage: 'Job is closed on external portal',
        };
      }

      // Fill known form fields
      const candidate = pkg.candidateData;
      if (candidate.fullName) {
        const nameInput = page.locator('input[name="name"], input[name="fullName"], input[placeholder*="Nome" i]').first();
        if (await nameInput.isVisible()) await nameInput.fill(String(candidate.fullName));
      }
      if (candidate.email) {
        const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="Email" i]').first();
        if (await emailInput.isVisible()) await emailInput.fill(String(candidate.email));
      }
      if (candidate.phone) {
        const phoneInput = page.locator('input[type="tel"], input[name="phone"], input[placeholder*="Telefone" i]').first();
        if (await phoneInput.isVisible()) await phoneInput.fill(String(candidate.phone));
      }

      // Upload resume file
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.isVisible()) {
        await fileInput.setInputFiles({
          name: pkg.resume.fileName,
          mimeType: pkg.resume.mimeType,
          buffer: pkg.resume.buffer,
        });
      }

      // Check submit button
      const submitBtn = page.locator('button[type="submit"], button:has-text("Enviar Candidatura"), button:has-text("Candidatar-se")').first();
      if (await submitBtn.isVisible()) {
        const isDisabled = await submitBtn.isDisabled();
        if (isDisabled) {
          return {
            outcome: 'MANUAL_ACTION_REQUIRED',
            errorCode: 'FORM_REQUIRED_FIELD_MISSING',
            errorMessage: 'Submit button is disabled due to missing required fields',
          };
        }
      }

      // Listen for official API response BEFORE click (ADR-009, SDD-003, OQ-05)
      const officialResponsePromise = page.waitForResponse(
        (res) => (res.url().includes('/job-talents/public/') || res.url().includes('/talents')) && res.request().method() === 'POST',
        { timeout: 15000 },
      ).catch(() => null);

      if (await submitBtn.isVisible()) {
        await submitBtn.click();
      }

      const officialResponse = await officialResponsePromise;

      if (!officialResponse) {
        // Button was clicked, but no conclusive official response intercepted
        return {
          outcome: 'OUTCOME_UNKNOWN',
          errorCode: 'SUBMISSION_OUTCOME_UNKNOWN',
          errorMessage: 'Application may have been submitted but no official confirmation was received',
        };
      }

      if (officialResponse.status() >= 200 && officialResponse.status() < 300) {
        const endpointFingerprint = `POST ${officialResponse.url()}`;
        const confirmationFingerprint = `CONF-${officialResponse.status()}-${Date.now()}`;

        return {
          outcome: 'SUCCEEDED',
          receiptDetails: {
            endpointFingerprint,
            responseStatus: officialResponse.status(),
            confirmationFingerprint,
            artifactChecksum: pkg.resume.checksum,
            externalRequestId: officialResponse.headers()['x-request-id'],
          },
        };
      } else {
        return {
          outcome: 'RETRYABLE_FAILURE',
          errorCode: 'EXTERNAL_UNAVAILABLE',
          errorMessage: `Official endpoint returned ${officialResponse.status()}`,
        };
      }
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error({
        operation: 'playwright_submit_exception',
        error: error.message,
      }, error.stack, 'PlaywrightApplicationSubmitter');

      return {
        outcome: 'RETRYABLE_FAILURE',
        errorCode: 'EXTERNAL_UNAVAILABLE',
        errorMessage: error.message,
      };
    } finally {
      // Clean up browser and context safely without unhandled rejections
      if (context) await context.close().catch(() => null);
      if (browser) await browser.close().catch(() => null);
    }
  }
}
