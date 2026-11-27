import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Global throttler that can be switched off with RATE_LIMITS_ENABLED=false (used by tests).
 * The flag is read from the environment, which config validation has already checked at boot.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(): Promise<boolean> {
    return process.env.RATE_LIMITS_ENABLED === 'false' || process.env.RATE_LIMITS_ENABLED === '0';
  }
}
