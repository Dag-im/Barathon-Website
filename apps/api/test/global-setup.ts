import { execSync } from 'child_process';
import { resolve } from 'path';

/** Applies migrations to the test database once before the e2e suites run. */
export default function globalSetup(): void {
  require('./setup-env');
  const cwd = resolve(__dirname, '..');
  execSync('npx prisma migrate deploy', { cwd, stdio: 'inherit', env: process.env });
}
