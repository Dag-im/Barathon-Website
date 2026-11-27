import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import { Readable } from 'stream';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';
import { MemoryStorageDriver } from '../src/storage/memory.driver';
import { PrismaService } from '../src/prisma/prisma.service';

export const ORIGIN = 'http://localhost:3000';
export const ADMIN_EMAIL = 'admin@example.com';
export const ADMIN_PASSWORD = 'Correct-Horse-Battery-9';

/** Boots the full application against the test database with an in-memory object store. */
export async function createTestApp(): Promise<{ app: INestApplication; storage: MemoryStorageDriver }> {
  const memory = new MemoryStorageDriver();
  const fake = {
    bucketPublic: 'public-media',
    bucketPrivate: 'private-docs',
    raw: memory,
    ping: async () => true,
    onModuleInit: async () => undefined,
    setDriver: () => undefined,
  };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(StorageService)
    .useValue(fake)
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('api/v1', { exclude: ['api/docs', 'api/docs-json', 'api/v1/openapi.json'] });
  app.use(cookieParser());
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  await app.init();
  return { app, storage: memory };
}

/** Removes all rows from every application table (keeps the migrations table). */
export async function resetDatabase(): Promise<void> {
  const prisma = new PrismaClient();
  const tables = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
  );
  if (tables.length) {
    await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  }
  await prisma.$disconnect();
}

export function cookieHeader(setCookie: string[] | string | undefined): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return list.map((c) => c.split(';')[0]).join('; ');
}

export function cookieValue(setCookie: string[] | undefined, name: string): string | null {
  for (const c of setCookie ?? []) {
    if (c.startsWith(`${name}=`)) return decodeURIComponent(c.split(';')[0].slice(name.length + 1));
  }
  return null;
}

export const bufferStream = (b: Buffer) => Readable.from([b]);
export { PrismaService };
