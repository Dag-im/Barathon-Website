import { PipeTransform } from '@nestjs/common';
import type { ZodTypeAny, z } from 'zod';
import { ApiError } from '../utils/errors';

/** Validates a request part with a zod schema; failures become 422 VALIDATION_FAILED. */
export class ZodPipe<T extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      throw ApiError.validation(
        result.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'body',
          message: issue.message,
          code: issue.code,
        })),
      );
    }
    return result.data;
  }
}

export const zodPipe = <T extends ZodTypeAny>(schema: T) => new ZodPipe(schema);
