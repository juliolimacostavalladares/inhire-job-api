export type SubmissionOutcomeType =
  | 'SUCCEEDED'
  | 'RETRYABLE_FAILURE'
  | 'PERMANENT_FAILURE'
  | 'MANUAL_ACTION_REQUIRED'
  | 'OUTCOME_UNKNOWN';

export interface SubmissionReceiptDetails {
  endpointFingerprint: string;
  responseStatus: number;
  confirmationFingerprint: string;
  artifactChecksum: string;
  externalRequestId?: string;
}

export interface SubmissionOutcomeResult {
  outcome: SubmissionOutcomeType;
  errorCode?: string;
  errorMessage?: string;
  receiptDetails?: SubmissionReceiptDetails;
  evidenceRef?: string;
}
