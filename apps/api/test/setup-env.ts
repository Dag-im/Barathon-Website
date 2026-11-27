// Loaded by Jest before any test module: fixed, non-production configuration for the test database.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://barathon:barathon@localhost:5432/barathon_test?schema=public';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789abcdef-XYZ';
process.env.PASSWORD_PEPPER = 'test-pepper-0123456789abcdef0123456789';
process.env.ADMIN_RESET_PASSWORD = 'Reset-Default-2026';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
process.env.PUBLIC_SITE_URL = 'http://localhost:3000';
process.env.PUBLIC_MEDIA_BASE_URL = 'http://localhost:3000/media';
process.env.API_PUBLIC_URL = 'http://localhost:4000/api/v1';
process.env.COOKIE_SECURE = 'false';
process.env.RATE_LIMITS_ENABLED = 'false';
process.env.LOG_LEVEL = 'silent';
process.env.LOGIN_MAX_FAILURES = '5';
process.env.LOCKOUT_BASE_MINUTES = '15';
process.env.ARGON2_MEMORY_KIB = '8192';
process.env.ARGON2_TIME_COST = '2';
