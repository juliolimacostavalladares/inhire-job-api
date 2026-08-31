export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'RESOURCE_NOT_FOUND'
  | 'PROFILE_NOT_STARTED'
  | 'RESUME_NOT_STARTED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'APPLICATION_ALREADY_EXISTS'
  | 'INVALID_STATE_TRANSITION'
  | 'PROFILE_NOT_READY'
  | 'JOB_NOT_PUBLISHED'
  | 'JOB_URL_NOT_ALLOWED'
  | 'RESUME_GENERATION_FAILED'
  | 'RESUME_ARTIFACT_INVALID'
  | 'FORM_REQUIRED_FIELD_MISSING'
  | 'FORM_SCHEMA_UNSUPPORTED'
  | 'EXTERNAL_JOB_CLOSED'
  | 'EXTERNAL_RATE_LIMITED'
  | 'EXTERNAL_UNAVAILABLE'
  | 'SUBMISSION_OUTCOME_UNKNOWN'
  | 'SUBMISSION_RECEIPT_INVALID'
  | 'QUOTA_EXCEEDED'
  | 'QUEUE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface FieldError {
  path: string;
  code: string;
  message?: string;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly detail?: string;
  public readonly fields?: FieldError[];

  constructor(code: ErrorCode, statusCode: number, message: string, detail?: string, fields?: FieldError[]) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.detail = detail ?? message;
    this.fields = fields;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public static validationFailed(message = 'Validation failed', fields?: FieldError[]): AppError {
    return new AppError('VALIDATION_FAILED', 400, message, message, fields);
  }

  public static unauthenticated(message = 'Authentication required'): AppError {
    return new AppError('UNAUTHENTICATED', 401, message);
  }

  public static forbidden(message = 'Access forbidden'): AppError {
    return new AppError('FORBIDDEN', 403, message);
  }

  public static notFound(message = 'Resource not found', code: ErrorCode = 'RESOURCE_NOT_FOUND'): AppError {
    return new AppError(code, 404, message);
  }

  public static profileNotStarted(message = 'Profile not started'): AppError {
    return new AppError('PROFILE_NOT_STARTED', 404, message);
  }

  public static resumeNotStarted(message = 'Resume not started'): AppError {
    return new AppError('RESUME_NOT_STARTED', 404, message);
  }

  public static idempotencyConflict(message = 'Idempotency key conflict'): AppError {
    return new AppError('IDEMPOTENCY_CONFLICT', 409, message);
  }

  public static applicationAlreadyExists(message = 'Application already exists for this job'): AppError {
    return new AppError('APPLICATION_ALREADY_EXISTS', 409, message);
  }

  public static invalidStateTransition(message = 'Invalid state transition'): AppError {
    return new AppError('INVALID_STATE_TRANSITION', 409, message);
  }

  public static profileNotReady(message = 'Profile is not ready for this purpose', fields?: FieldError[]): AppError {
    return new AppError('PROFILE_NOT_READY', 422, message, message, fields);
  }

  public static jobNotPublished(message = 'Job is not published'): AppError {
    return new AppError('JOB_NOT_PUBLISHED', 422, message);
  }

  public static jobUrlNotAllowed(message = 'Job URL is not in allowed format or host'): AppError {
    return new AppError('JOB_URL_NOT_ALLOWED', 422, message);
  }

  public static resumeGenerationFailed(message = 'Resume generation failed', isRetryable = false): AppError {
    return new AppError('RESUME_GENERATION_FAILED', isRetryable ? 503 : 422, message);
  }

  public static resumeArtifactInvalid(message = 'Resume artifact invalid'): AppError {
    return new AppError('RESUME_ARTIFACT_INVALID', 422, message);
  }

  public static formRequiredFieldMissing(message = 'Required form field missing', fields?: FieldError[]): AppError {
    return new AppError('FORM_REQUIRED_FIELD_MISSING', 422, message, message, fields);
  }

  public static formSchemaUnsupported(message = 'Form schema contains unsupported controls'): AppError {
    return new AppError('FORM_SCHEMA_UNSUPPORTED', 422, message);
  }

  public static externalJobClosed(message = 'External job is closed'): AppError {
    return new AppError('EXTERNAL_JOB_CLOSED', 422, message);
  }

  public static externalRateLimited(message = 'External rate limit reached'): AppError {
    return new AppError('EXTERNAL_RATE_LIMITED', 503, message);
  }

  public static externalUnavailable(message = 'External service unavailable'): AppError {
    return new AppError('EXTERNAL_UNAVAILABLE', 503, message);
  }

  public static submissionOutcomeUnknown(message = 'Submission outcome is unknown'): AppError {
    return new AppError('SUBMISSION_OUTCOME_UNKNOWN', 422, message);
  }

  public static submissionReceiptInvalid(message = 'Submission receipt invalid'): AppError {
    return new AppError('SUBMISSION_RECEIPT_INVALID', 500, message);
  }

  public static quotaExceeded(message = 'Auto apply daily quota exceeded'): AppError {
    return new AppError('QUOTA_EXCEEDED', 429, message);
  }

  public static queueUnavailable(message = 'Queue service temporarily unavailable'): AppError {
    return new AppError('QUEUE_UNAVAILABLE', 503, message);
  }

  public static internal(message = 'Internal server error'): AppError {
    return new AppError('INTERNAL_ERROR', 500, message);
  }
}
