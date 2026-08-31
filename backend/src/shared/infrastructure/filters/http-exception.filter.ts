import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { AppError } from '@shared/domain/errors/app-error';

export interface ErrorContractResponse {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  instance: string;
  correlationId: string;
  fields?: Array<{ path: string; code: string; message?: string }>;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId = (request.headers['x-correlation-id'] as string) || 'unknown-correlation-id';
    const instance = request.originalUrl || request.url;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let title = 'Internal server error';
    let detail = 'An unexpected error occurred';
    let fields: Array<{ path: string; code: string; message?: string }> | undefined = undefined;

    if (exception instanceof AppError) {
      status = exception.statusCode;
      code = exception.code;
      title = exception.message;
      detail = exception.detail || exception.message;
      fields = exception.fields;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        code = (resObj['code'] as string) || (status === 400 ? 'VALIDATION_FAILED' : status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'RESOURCE_NOT_FOUND' : 'INTERNAL_ERROR');
        title = (resObj['error'] as string) || exception.message;
        detail = (resObj['message'] as string) || exception.message;
        if (Array.isArray(resObj['message'])) {
          detail = resObj['message'].join(', ');
          fields = (resObj['message'] as string[]).map((msg) => ({
            path: 'body',
            code: 'VALIDATION_ERROR',
            message: msg,
          }));
        }
      } else {
        detail = String(res);
        title = exception.message;
      }
    } else if (exception instanceof Error) {
      detail = exception.message;
      title = exception.name || 'Error';
    }

    const payload: ErrorContractResponse = {
      type: `https://errors.inhire.internal/${code}`,
      title,
      status,
      code,
      detail,
      instance,
      correlationId,
      ...(fields && fields.length > 0 ? { fields } : {}),
    };

    response.status(status).json(payload);
  }
}
