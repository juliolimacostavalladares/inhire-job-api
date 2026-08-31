import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { OfficialApplicationSubmitter, ApplicationPackage } from '../../application/ports/official-application-submitter.port';
import { SubmissionOutcomeResult } from '../../domain/submission-outcome.vo';

@Injectable()
export class MockApplicationSubmitter implements OfficialApplicationSubmitter {
  async submit(pkg: ApplicationPackage): Promise<SubmissionOutcomeResult> {
    // Check if jobUrl is valid HTTPS and allowed host
    const url = new URL(pkg.jobUrl);
    const host = url.hostname.toLowerCase();
    if (!host.includes('inhire') && host !== 'localhost' && host !== '127.0.0.1') {
      return {
        outcome: 'PERMANENT_FAILURE',
        errorCode: 'JOB_URL_NOT_ALLOWED',
        errorMessage: `Host ${host} not permitted`,
      };
    }

    // Check required fields
    if (!pkg.candidateData.email || !pkg.candidateData.fullName) {
      return {
        outcome: 'MANUAL_ACTION_REQUIRED',
        errorCode: 'FORM_REQUIRED_FIELD_MISSING',
        errorMessage: 'Required fields missing for official submission',
      };
    }

    const endpointFingerprint = 'POST https://api.inhire.app/job-talents/public/apply';
    const confirmationFingerprint = `CONF-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const artifactChecksum = pkg.resume.checksum;

    return {
      outcome: 'SUCCEEDED',
      receiptDetails: {
        endpointFingerprint,
        responseStatus: 201,
        confirmationFingerprint,
        artifactChecksum,
        externalRequestId: `req-${crypto.randomBytes(6).toString('hex')}`,
      },
    };
  }
}
