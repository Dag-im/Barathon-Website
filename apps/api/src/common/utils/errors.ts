import { HttpException } from '@nestjs/common';

export interface ErrorDetail {
  field: string;
  message: string;
  code?: string;
  [extra: string]: unknown;
}

/** Application error carrying the public error code from the API error catalogue. */
export class ApiError extends HttpException {
  constructor(
    status: number,
    public readonly code: string,
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super({ code, message, details }, status);
  }

  static notFound(what = 'Resource'): ApiError {
    return new ApiError(404, 'NOT_FOUND', `${what} not found`);
  }

  static validation(details: ErrorDetail[], message = 'Validation failed'): ApiError {
    return new ApiError(422, 'VALIDATION_FAILED', message, details);
  }

  static invalidCredentials(): ApiError {
    return new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

  static refreshInvalid(): ApiError {
    return new ApiError(401, 'REFRESH_INVALID', 'Your session has expired. Sign in again.');
  }

  static locked(retryAfterSeconds: number): ApiError {
    return new ApiError(423, 'ACCOUNT_LOCKED', 'Too many attempts. Try again later.', [
      { field: 'retryAfterSeconds', message: String(retryAfterSeconds) },
    ]);
  }

  static tooMany(retryAfterSeconds: number): ApiError {
    const err = new ApiError(429, 'RATE_LIMITED', 'Too many requests. Try again later.');
    err.retryAfterSeconds = retryAfterSeconds;
    return err;
  }

  retryAfterSeconds?: number;

  static conflict(code: string, message: string, details?: ErrorDetail[]): ApiError {
    return new ApiError(409, code, message, details);
  }
}
