import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { readFileSync } from 'fs';
import { createInterface } from 'readline';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { PasswordService } from './auth/password.service';
import { AuditService } from './audit/audit.service';
import { SettingsService } from './settings/settings.service';
import { NavigationService } from './navigation/navigation.service';
import { MediaService } from './media/media.service';
import { AppConfig, APP_CONFIG } from './config/config';
import { RevalidationService } from './revalidation/revalidation.service';
import { seedAll, newSeedReport, writeReport } from './seed/seed';
import { seedAssets } from './seed/assets';
import { resolve } from 'path';

type Args = Record<string, string | boolean>;

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

async function readPassword(args: Args): Promise<string> {
  if (args['password-stdin']) {
    const chunks: string[] = [];
    for await (const chunk of process.stdin) chunks.push(String(chunk));
    return chunks.join('').replace(/\r?\n$/, '');
  }
  if (process.env.ADMIN_BOOTSTRAP_PASSWORD && args['from-env']) return process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>((res) => rl.question(q, res));
  const first = await ask('Password: ');
  const second = await ask('Repeat password: ');
  rl.close();
  if (first !== second) throw new Error('Passwords do not match');
  return first;
}

const system = { userId: null, email: 'CLI', ip: null, userAgent: null, requestId: null };

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  try {
    const prisma = app.get(PrismaService);
    const passwords = app.get(PasswordService);
    const audit = app.get(AuditService);
    const db = prisma.client;
    switch (command) {
      case 'admin:create': {
        const email = String(args.email ?? '').trim().toLowerCase();
        const name = String(args.name ?? '').trim();
        if (!email || !name) throw new Error('--email and --name are required');
        if (await db.user.findFirst({ where: { email } })) throw new Error('An account with this email already exists');
        const password = await readPassword(args);
        passwords.assertPolicy(password, email.split('@')[0]);
        const user = await db.user.create({ data: { email, name, passwordHash: await passwords.hash(password), mustChangePassword: false } });
        await audit.record({ action: 'CREATE', summary: `Administrator ${email} created from the CLI`, entityType: 'User', entityId: user.id, actorEmail: 'CLI' });
        console.log(`created administrator ${email}`);
        break;
      }
      case 'admin:reset-password': {
        const email = String(args.email ?? '').trim().toLowerCase();
        const user = await db.user.findFirst({ where: { email } });
        if (!user) throw new Error('No account with this email');
        const config = app.get<AppConfig>(APP_CONFIG);
        await db.$transaction([
          db.user.update({ where: { id: user.id }, data: { passwordHash: await passwords.hash(config.env.ADMIN_RESET_PASSWORD), mustChangePassword: true, tokenVersion: { increment: 1 }, failedLoginCount: 0, lockedUntil: null } }),
          db.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'PASSWORD_RESET' } }),
        ]);
        await audit.record({ action: 'PASSWORD_RESET', summary: `Password reset to the default for ${email} (CLI)`, entityType: 'User', entityId: user.id, actorEmail: 'CLI' });
        console.log(`password reset to the configured default for ${email}; the next sign-in must choose a new password`);
        break;
      }
      case 'admin:unlock': {
        const email = String(args.email ?? '').trim().toLowerCase();
        const user = await db.user.findFirst({ where: { email } });
        if (!user) throw new Error('No account with this email');
        await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockCount: 0, lockedUntil: null } });
        await audit.record({ action: 'ACCOUNT_UNLOCKED', summary: `Account ${email} unlocked (CLI)`, entityType: 'User', entityId: user.id, actorEmail: 'CLI' });
        console.log(`unlocked ${email}`);
        break;
      }
      case 'admin:list': {
        const users = await db.user.findMany({ orderBy: { email: 'asc' } });
        for (const u of users) console.log(`${u.email}\t${u.name}\tactive=${u.isActive}\tmustChangePassword=${u.mustChangePassword}\tlockedUntil=${u.lockedUntil?.toISOString() ?? '-'}`);
        break;
      }
      case 'seed': {
        const settings = app.get(SettingsService);
        const nav = app.get(NavigationService);
        const config = app.get<AppConfig>(APP_CONFIG);
        const report = newSeedReport();
        const sourceDir = process.env.SEED_SOURCE_DIR ?? resolve(__dirname, '..', '..', '..', 'docs', 'source');
        void sourceDir;
        await seedAll(prisma, settings, nav, passwords, audit, {
          adminEmail: config.env.ADMIN_BOOTSTRAP_EMAIL || undefined,
          adminName: 'Administrator',
          adminPassword: config.env.ADMIN_BOOTSTRAP_PASSWORD || undefined,
          report,
        });
        const path = writeReport(report);
        console.log(`seed complete; report written to ${path}`);
        break;
      }
      case 'seed:assets': {
        const config = app.get<AppConfig>(APP_CONFIG);
        const media = app.get(MediaService);
        const report = newSeedReport();
        const sourceDir = process.env.SEED_SOURCE_DIR ?? resolve(__dirname, '..', '..', '..', 'docs', 'source');
        const result = await seedAssets({ prisma, media, config }, report, sourceDir);
        app.get(RevalidationService);
        const path = writeReport(report);
        console.log(`assets: ${result.ok} stored, ${result.failed} failed; report at ${path}`);
        break;
      }
      case 'db:check': {
        const counts = {
          products: await db.product.count(),
          brands: await db.brand.count(),
          services: await db.service.count(),
          videos: await db.video.count(),
          pages: await db.page.count(),
          users: await db.user.count(),
          media: await db.media.count(),
        };
        console.log(JSON.stringify(counts, null, 2));
        break;
      }
      default:
        console.log('usage: cli <admin:create|admin:reset-password|admin:unlock|admin:list|seed|seed:assets|db:check> [--email ...] [--name ...] [--password-stdin]');
        process.exitCode = 1;
    }
    void readFileSync;
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(`error: ${(err as Error).message}`);
  process.exitCode = 1;
});
