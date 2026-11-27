import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/errors';

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'VALIDATION_FAILED',
  423: 'ACCOUNT_LOCKED',
  429: 'RATE_LIMITED',
  500: 'INTERNAL',
  503: 'NOT_READY',
};

/** Renders every error in the standard envelope (backend-plan 6.1.4). */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { id?: string }>();
    const res = ctx.getResponse<Response>();
    const requestId = req.id ?? 'unknown';

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL';
    let message = 'Internal server error';
    let details: unknown[] | undefined;

    if (exception instanceof ApiError) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as Record<string, unknown> | string;
      code = STATUS_CODES[status] ?? 'ERROR';
      if (typeof body === 'object' && body) {
        if (typeof body.code === 'string') code = body.code;
        message = typeof body.message === 'string' ? body.message : exception.message;
        if (Array.isArray(body.details)) details = body.details;
        if (Array.isArray(body.message)) {
          code = 'VALIDATION_FAILED';
          details = body.message.map((m) => ({ field: 'body', message: String(m) }));
          message = 'Validation failed';
        }
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') {
        status = 404;
        code = 'NOT_FOUND';
        message = 'Resource not found';
      } else if (exception.code === 'P2002') {
        status = 409;
        code = 'CONFLICT';
        message = 'A unique value already exists';
      } else {
        this.logger.error({ requestId, err: exception.code }, 'database error');
      }
    } else if (exception instanceof SyntaxError && 'body' in (exception as object)) {
      status = 400;
      code = 'BAD_REQUEST';
      message = 'Malformed JSON body';
    }

    const known = exception instanceof ApiError || exception instanceof HttpException;
    if (status >= 500 && !known) {
      this.logger.error(
        { requestId, path: req.url, err: exception instanceof Error ? exception.stack : String(exception) },
        'unhandled error',
      );
      code = 'INTERNAL';
      message = 'Internal server error';
      details = undefined;
    } else if (status >= 500) {
      this.logger.warn({ requestId, code, path: req.url }, 'service unavailable');
    }

    res.status(status).json({
      statusCode: status,
      code,
      message,
      ...(details && details.length ? { details } : {}),
      requestId,
      timestamp: new Date().toISOString(),
      path: req.originalUrl ?? req.url,
    });
  }
}
