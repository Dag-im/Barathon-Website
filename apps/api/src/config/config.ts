import { z } from 'zod';

export const APP_CONFIG = Symbol('APP_CONFIG');

const bool = (def: boolean) =>
  z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => (v === undefined ? def : v === 'true' || v === '1'));

const csv = (def: string) =>
  z
    .string()
    .default(def)
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean));

const PLACEHOLDER = /change-me|placeholder|example\.com|^$/i;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'silent']).default('info'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
  ADMIN_URL: z.string().url().default('http://localhost:3000'),
  ALLOWED_ORIGINS: csv('http://localhost:3000'),
  API_PUBLIC_URL: z.string().url().default('http://localhost:3000/api/v1'),
  PUBLIC_MEDIA_BASE_URL: z.string().url().default('http://localhost:3000/media'),
  REDIRECT_ALLOWED_HOSTS: csv('localhost'),
  INTERNAL_API_KEY: z.string().default(''),

  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().int().default(10),

  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().int().default(9000),
  MINIO_USE_SSL: bool(false),
  MINIO_ACCESS_KEY: z.string().default('barathon-api'),
  MINIO_SECRET_KEY: z.string().default('change-me'),
  MINIO_REGION: z.string().default('us-east-1'),
  MINIO_BUCKET_PUBLIC: z.string().default('public-media'),
  MINIO_BUCKET_PRIVATE: z.string().default('private-docs'),
  MAX_IMAGE_UPLOAD_MB: z.coerce.number().default(12),
  MAX_VIDEO_UPLOAD_MB: z.coerce.number().default(200),
  MAX_DOCUMENT_UPLOAD_MB: z.coerce.number().default(25),
  FFMPEG_PATH: z.string().default(''),

  JWT_ACCESS_SECRET: z.string().min(32),
  ACCESS_TTL_SECONDS: z.coerce.number().int().default(900),
  REFRESH_IDLE_DAYS: z.coerce.number().int().default(14),
  SESSION_ABSOLUTE_DAYS: z.coerce.number().int().default(30),
  COOKIE_SECURE: bool(false),
  ALLOW_BEARER: bool(false),
  PASSWORD_PEPPER: z.string().min(32),
  ARGON2_MEMORY_KIB: z.coerce.number().int().default(65536),
  ARGON2_TIME_COST: z.coerce.number().int().default(3),
  ADMIN_RESET_PASSWORD: z.string().min(12),
  LOGIN_MAX_FAILURES: z.coerce.number().int().default(5),
  LOCKOUT_BASE_MINUTES: z.coerce.number().int().default(15),
  ADMIN_BOOTSTRAP_EMAIL: z.string().default(''),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().default(''),

  RATE_LIMITS_ENABLED: bool(true),
  SWAGGER_ENABLED: bool(true),
  WEB_REVALIDATE_URL: z.string().default(''),
  REVALIDATE_SECRET: z.string().default(''),
  CAPTCHA_PROVIDER: z.enum(['NONE', 'TURNSTILE', 'HCAPTCHA']).default('NONE'),
  CAPTCHA_SECRET: z.string().default(''),
  SEED_ASSET_HOSTS: csv('res.cloudinary.com'),
  SEED_DOWNLOAD_TIMEOUT_MS: z.coerce.number().int().default(15000),
  MESSAGE_IP_TRUNCATE_DAYS: z.coerce.number().int().default(90),
  AUDIT_RETENTION_DAYS: z.coerce.number().int().default(365),
  TRASH_RETENTION_DAYS: z.coerce.number().int().default(30),
});

export type RawEnv = z.infer<typeof envSchema>;

export interface AppConfig {
  env: RawEnv;
  isProduction: boolean;
  cookieNames: { access: string; refresh: string; csrf: string };
  cookiePaths: { access: string; refresh: string; csrf: string };
  accessTtlSeconds: number;
  refreshIdleMs: number;
  sessionAbsoluteMs: number;
}

/**
 * Validates the process environment. Throws an Error listing every problem so the
 * process can refuse to start with a readable message.
 */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  const env = parsed.data;
  const isProduction = env.NODE_ENV === 'production';

  if (isProduction) {
    const problems: string[] = [];
    const secretKeys = ['JWT_ACCESS_SECRET', 'PASSWORD_PEPPER', 'ADMIN_RESET_PASSWORD', 'MINIO_SECRET_KEY', 'REVALIDATE_SECRET'] as const;
    for (const key of secretKeys) {
      const value = env[key];
      if (PLACEHOLDER.test(value) && key !== 'REVALIDATE_SECRET') problems.push(`${key} is a placeholder value`);
    }
    if (!env.COOKIE_SECURE) problems.push('COOKIE_SECURE must be true in production');
    if (env.ALLOW_BEARER) problems.push('ALLOW_BEARER must be false in production');
    if (problems.length) {
      throw new Error(`Unsafe production configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    }
  }

  const prefix = env.COOKIE_SECURE ? '__Host-' : '';
  const securePrefix = env.COOKIE_SECURE ? '__Secure-' : '';
  return {
    env,
    isProduction,
    cookieNames: {
      access: `${prefix}bt_at`,
      refresh: `${securePrefix}bt_rt`,
      csrf: `${securePrefix}bt_csrf`,
    },
    cookiePaths: {
      access: '/',
      refresh: '/api/v1/auth',
      csrf: '/',
    },
    accessTtlSeconds: env.ACCESS_TTL_SECONDS,
    refreshIdleMs: env.REFRESH_IDLE_DAYS * 86_400_000,
    sessionAbsoluteMs: env.SESSION_ABSOLUTE_DAYS * 86_400_000,
  };
}
