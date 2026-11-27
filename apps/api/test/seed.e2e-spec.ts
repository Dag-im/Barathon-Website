import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createTestApp, resetDatabase } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { SettingsService } from '../src/settings/settings.service';
import { NavigationService } from '../src/navigation/navigation.service';
import { PasswordService } from '../src/auth/password.service';
import { AuditService } from '../src/audit/audit.service';
import { seedAll, newSeedReport } from '../src/seed/seed';

describe('Legacy content seed (e2e)', () => {
  let app: INestApplication;
  let db: PrismaClient;

  const runSeed = () =>
    seedAll(app.get(PrismaService), app.get(SettingsService), app.get(NavigationService), app.get(PasswordService), app.get(AuditService), {
      adminEmail: 'seed-admin@example.com',
      adminPassword: 'Seed-Admin-Passphrase-1',
      report: newSeedReport(),
    });

  beforeAll(async () => {
    ({ app } = await createTestApp());
    db = new PrismaClient();
  });

  afterAll(async () => {
    await db.$disconnect();
    await app.close();
  });

  it('imports the source content with the expected counts and typo fixes', async () => {
    await resetDatabase();
    const report = await runSeed();
    expect(await db.product.count()).toBe(8);
    expect(await db.brand.count()).toBe(9);
    expect(await db.service.count()).toBe(2);
    expect(await db.serviceFeature.count()).toBe(9);
    expect(await db.subsidiary.count()).toBe(2);
    expect(await db.timelineEntry.count()).toBe(4);
    expect(await db.coreValue.count({ where: { group: 'MISSION' } })).toBe(4);
    expect(await db.leaderMessage.count()).toBe(1);
    expect(await db.contactChannel.count()).toBe(4);
    expect(await db.office.count()).toBe(2);
    expect(await db.socialLink.count({ where: { visible: true } })).toBe(0);
    expect(await db.menu.count()).toBe(4);
    expect(await db.page.count()).toBe(4);
    expect(await db.video.count({ where: { sourceType: 'YOUTUBE' } })).toBe(12);
    expect(report.invalidYoutube.join(' ')).toContain('"a"');

    const brandNames = (await db.brand.findMany({ select: { name: true } })).map((b) => b.name);
    expect(brandNames).toContain('Sumitomo Construction Machinery Co., Ltd.');
    expect(brandNames).toContain('Walter Gerätebau');

    const everything = JSON.stringify([
      await db.product.findMany(),
      await db.brand.findMany(),
      await db.service.findMany(),
      await db.serviceFeature.findMany(),
      await db.page.findMany({ include: { blocks: true } }),
      await db.siteSettings.findMany(),
      await db.office.findMany(),
    ]);
    for (const bad of ['Bussiness', 'FURKAWA', 'has resented', 'is was formed', 'Geratebou']) {
      expect(everything).not.toContain(bad);
    }
    expect(everything).not.toMatch(/(?<!P)redictive/);
    const monark = await db.product.findFirst({ where: { slug: 'monark' } });
    expect(monark?.countryCode).toBe('SE');
    expect(monark?.originCity).toBe('Ockelbo');
    const nakayama = await db.product.findFirst({ where: { slug: 'nakayama-crushers' } });
    expect(nakayama?.contentHtml).toContain('<strong>');
    expect(nakayama?.contentHtml).not.toMatch(/<h1>Nakayama crushers/);
  });

  it('is idempotent and never overwrites admin edits', async () => {
    const before = { products: await db.product.count(), brands: await db.brand.count(), videos: await db.video.count(), users: await db.user.count() };
    await db.product.update({ where: { slug: 'monark' }, data: { title: 'Monark (edited by admin)' } });
    await runSeed();
    expect(await db.product.count()).toBe(before.products);
    expect(await db.brand.count()).toBe(before.brands);
    expect(await db.video.count()).toBe(before.videos);
    expect(await db.user.count()).toBe(before.users);
    const edited = await db.product.findFirst({ where: { slug: 'monark' } });
    expect(edited?.title).toBe('Monark (edited by admin)');
    const admin = await db.user.findFirst({ where: { email: 'seed-admin@example.com' } });
    expect(admin?.mustChangePassword).toBe(true);
  });
});
