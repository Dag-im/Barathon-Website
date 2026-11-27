import { Inject, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AppConfig, APP_CONFIG } from '../config/config';
import { ApiError } from '../common/utils/errors';
import { createHmac, randomBytes } from 'crypto';

// zxcvbn is CommonJS; loaded lazily so the module graph stays simple.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const zxcvbn: (password: string, userInputs?: string[]) => { score: number } = require('zxcvbn');

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;
export const PASSWORD_HISTORY_SIZE = 5;

export type PolicyIssue = { field: string; message: string; code: string };

@Injectable()
export class PasswordService {
  /** Constant hash used to keep unknown-account logins at the same cost as real ones. */
  private dummyHash: Promise<string> | null = null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  private argonOptions(): Parameters<typeof argon2.hash>[1] & object {
    return {
      type: argon2.argon2id,
      memoryCost: this.config.env.ARGON2_MEMORY_KIB,
      timeCost: this.config.env.ARGON2_TIME_COST,
      parallelism: 1,
      hashLength: 32,
    } as Parameters<typeof argon2.hash>[1] & object;
  }

  private peppered(password: string): string {
    return createHmac('sha256', this.config.env.PASSWORD_PEPPER).update(password).digest('base64');
  }

  hash(password: string): Promise<string> {
    return argon2.hash(this.peppered(password), this.argonOptions()) as Promise<string>;
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, this.peppered(password));
    } catch {
      return false;
    }
  }

  /** Spends the same time as a real verify when the account does not exist. */
  async verifyDummy(password: string): Promise<void> {
    this.dummyHash ??= argon2.hash(randomBytes(24).toString('hex'), this.argonOptions()) as Promise<string>;
    await argon2.verify(await this.dummyHash, this.peppered(password)).catch(() => false);
  }

  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, this.argonOptions());
  }

  /** Returns policy problems; an empty list means the password is acceptable. */
  policyIssues(password: string, emailLocalPart?: string): PolicyIssue[] {
    const issues: PolicyIssue[] = [];
    if (password.length < PASSWORD_MIN) {
      issues.push({ field: 'newPassword', code: 'too_short', message: `Password must be at least ${PASSWORD_MIN} characters` });
    }
    if (password.length > PASSWORD_MAX) {
      issues.push({ field: 'newPassword', code: 'too_long', message: `Password must be at most ${PASSWORD_MAX} characters` });
    }
    const inputs = ['barathon', 'baraton', 'barathon trading'];
    if (emailLocalPart && emailLocalPart.length >= 3) inputs.push(emailLocalPart);
    if (password.length >= PASSWORD_MIN && zxcvbn(password, inputs).score < 3) {
      issues.push({ field: 'newPassword', code: 'weak', message: 'Password is too guessable; use a longer or less common phrase' });
    }
    if (emailLocalPart && emailLocalPart.length >= 3 && password.toLowerCase().includes(emailLocalPart.toLowerCase())) {
      issues.push({ field: 'newPassword', code: 'contains_email', message: 'Password must not contain your email name' });
    }
    return issues;
  }

  assertPolicy(password: string, emailLocalPart?: string): void {
    const issues = this.policyIssues(password, emailLocalPart);
    if (issues.length) throw ApiError.validation(issues);
  }
}
