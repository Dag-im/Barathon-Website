import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { createTestApp, resetDatabase, ADMIN_EMAIL, ADMIN_PASSWORD, ORIGIN, cookieValue } from './helpers';
import { PasswordService } from '../src/auth/password.service';

const API = '/api/v1';

interface Session {
  jar: string[];
  csrf: string;
}

describe('Catalogue, media, contact and public read models (e2e)', () => {
  let app: INestApplication;
  let db: PrismaClient;
  let session: Session;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    db = new PrismaClient();
  });

  beforeEach(async () => {
    await resetDatabase();
    await db.user.create({ data: { email: ADMIN_EMAIL, name: 'Admin', passwordHash: await app.get(PasswordService).hash(ADMIN_PASSWORD) } });
    const res = await request(app.getHttpServer()).post(`${API}/auth/login`).set('Origin', ORIGIN).send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    const cookies = res.headers['set-cookie'] as unknown as string[];
    session = {
      csrf: cookieValue(cookies, 'bt_csrf') as string,
      jar: [`bt_at=${cookieValue(cookies, 'bt_at')}`, `bt_csrf=${cookieValue(cookies, 'bt_csrf')}`],
    };
  });

  afterAll(async () => {
    await db.$disconnect();
    await app.close();
  });

  const admin = () => request(app.getHttpServer());
  const writeHeaders = (r: request.Test) =>
    r.set('Origin', ORIGIN).set('X-CSRF-Token', session.csrf).set('Cookie', session.jar);

  it('publishes and unpublishes a product, enforces slug rules and creates a redirect on slug change', async () => {
    const created = await writeHeaders(admin().post(`${API}/admin/products`)).send({ title: 'Pump Alpha', shortDescription: 'A compact high pressure pump.' });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('DRAFT');
    expect(created.body.slug).toBe('pump-alpha');
    const id = created.body.id as string;

    expect((await request(app.getHttpServer()).get(`${API}/public/products/pump-alpha`)).status).toBe(404);

    const again = await writeHeaders(admin().post(`${API}/admin/products`)).send({ title: 'Pump Alpha', shortDescription: 'Second copy of the pump.' });
    expect(again.body.slug).toBe('pump-alpha-2');

    const taken = await writeHeaders(admin().post(`${API}/admin/products`)).send({ title: 'Other', slug: 'pump-alpha', shortDescription: 'Clash with explicit slug.' });
    expect(taken.status).toBe(409);
    expect(taken.body.code).toBe('SLUG_TAKEN');

    const published = await writeHeaders(admin().post(`${API}/admin/products/${id}/publish`)).send({});
    expect(published.status).toBe(200);
    const detail = await request(app.getHttpServer()).get(`${API}/public/products/pump-alpha`);
    expect(detail.status).toBe(200);
    expect(detail.body.seo.canonical).toBe('http://localhost:3000/products/pump-alpha');
    expect(detail.body.jsonLd ?? detail.body.seo.jsonLd).toBeDefined();

    const renamed = await writeHeaders(admin().patch(`${API}/admin/products/${id}`)).send({ slug: 'pump-beta' });
    expect(renamed.status).toBe(200);
    const redirect = await request(app.getHttpServer()).get(`${API}/public/redirects/resolve?path=/products/pump-alpha`);
    expect(redirect.body).toMatchObject({ match: true, target: '/products/pump-beta', type: 'MOVED_301' });

    const reserved = await writeHeaders(admin().post(`${API}/admin/products`)).send({ title: 'Admin', slug: 'admin', shortDescription: 'Reserved slug test.' });
    expect(reserved.body.code).toBe('SLUG_RESERVED');

    const unpub = await writeHeaders(admin().post(`${API}/admin/products/${id}/unpublish`)).send({});
    expect(unpub.body.status).toBe('DRAFT');
    expect((await request(app.getHttpServer()).get(`${API}/public/products/pump-beta`)).status).toBe(404);
  });

  it('keeps soft-deleted products out of the public list and restores them on request', async () => {
    const p = await writeHeaders(admin().post(`${API}/admin/products`)).send({ title: 'Trash Me', shortDescription: 'Will be moved to the trash.' });
    await writeHeaders(admin().post(`${API}/admin/products/${p.body.id}/publish`)).send({});
    await writeHeaders(admin().delete(`${API}/admin/products/${p.body.id}`));
    const list = await request(app.getHttpServer()).get(`${API}/public/products`);
    expect(list.body.data.find((x: { slug: string }) => x.slug === 'trash-me')).toBeUndefined();
    const trash = await writeHeaders(admin().get(`${API}/admin/products?deleted=true`));
    expect(trash.body.data.map((x: { slug: string }) => x.slug)).toContain('trash-me');
    const restored = await writeHeaders(admin().post(`${API}/admin/products/${p.body.id}/restore`)).send({});
    expect(restored.status).toBe(201);
    const back = await request(app.getHttpServer()).get(`${API}/public/products`);
    expect(back.body.data.find((x: { slug: string }) => x.slug === 'trash-me')).toBeDefined();
  });

  it('uses optimistic versioning on updates', async () => {
    const p = await writeHeaders(admin().post(`${API}/admin/products`)).send({ title: 'Version Check', shortDescription: 'Concurrency check.' });
    const first = await writeHeaders(admin().patch(`${API}/admin/products/${p.body.id}`)).send({ shortDescription: 'Edited once.', expectedVersion: p.body.version });
    expect(first.status).toBe(200);
    const stale = await writeHeaders(admin().patch(`${API}/admin/products/${p.body.id}`)).send({ shortDescription: 'Stale edit.', expectedVersion: p.body.version });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('VERSION_CONFLICT');
  });

  it('validates YouTube links and keeps only the 11-character id', async () => {
    const ok = await writeHeaders(admin().post(`${API}/admin/videos`)).send({ title: 'Short link', url: 'https://youtu.be/dQw4w9WgXcQ?t=42' });
    expect(ok.status).toBe(201);
    expect(ok.body.youtubeId).toBe('dQw4w9WgXcQ');
    expect(ok.body.startSeconds).toBe(42);
    expect(ok.body.embedUrl).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=42');
    const bad = await writeHeaders(admin().post(`${API}/admin/videos`)).send({ title: 'Not YouTube', url: 'https://example.com/x' });
    expect(bad.status).toBe(422);
    expect(bad.body.code).toBe('INVALID_YOUTUBE_URL');
  });

  it('uploads an image through the sharp pipeline and serves it in the public model', async () => {
    const png = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#2F3E7E' } }).png().toBuffer();
    const res = await writeHeaders(admin().post(`${API}/admin/media`)).attach('file', png, { filename: 'hero.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    const media = res.body.data[0].media;
    expect(media.kind).toBe('IMAGE');
    expect(media.width).toBe(1200);
    expect(media.blurhash).toBeTruthy();
    expect(media.dominantColor).toMatch(/^#[0-9a-f]{6}$/);
    const labels = media.variants.map((v: { label: string; format: string }) => `${v.label}.${v.format}`);
    expect(labels).toEqual(expect.arrayContaining(['w320.webp', 'w640.webp', 'thumb.webp']));
    expect(labels).not.toContain('w1920.webp');
    expect(media.url).toMatch(/\/media\/\d{4}\/\d{2}\/[0-9a-f-]{36}\/v1\/original\.png$/);
    expect(media.url).not.toContain('hero');
  });

  it('rejects files whose extension does not match their content', async () => {
    const png = await sharp({ create: { width: 50, height: 50, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const res = await writeHeaders(admin().post(`${API}/admin/media`)).attach('file', png, { filename: 'fake.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(415);
    expect(res.body.data).toBeUndefined();
  });

  it('stores an uploaded video and streams it with HTTP range support', async () => {
    const mp4 = Buffer.concat([Buffer.from('00000018667479706973six0000020000', 'hex').subarray(0, 0), Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(4), Buffer.from('isomavc1'), Buffer.alloc(2000, 7)]);
    const res = await writeHeaders(admin().post(`${API}/admin/videos/upload`)).field('title', 'Site tour').attach('file', mp4, { filename: 'tour.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(201);
    expect(res.body.sourceType).toBe('UPLOAD');
    const id = res.body.id as string;
    expect((await request(app.getHttpServer()).get(`${API}/public/videos/${id}`)).status).toBe(404);
    const pub = await writeHeaders(admin().post(`${API}/admin/videos/${id}/publish`)).send({});
    expect(pub.status).toBe(200);
    const detail = await request(app.getHttpServer()).get(`${API}/public/videos/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.mediaUrl).toMatch(/\/media\/.*original\.mp4$/);
    expect(detail.body.embedUrl).toBeNull();
    const ranged = await request(app.getHttpServer()).get(`${API}/public/videos/${id}/stream`).set('Range', 'bytes=0-7');
    expect(ranged.status).toBe(206);
    expect(ranged.headers['content-range']).toMatch(/^bytes 0-7\/\d+$/);
    expect(ranged.headers['accept-ranges']).toBe('bytes');
    expect(ranged.body.length).toBe(8);
  });

  it('accepts contact messages, drops honeypot submissions and reports validation problems', async () => {
    const good = await request(app.getHttpServer()).post(`${API}/public/contact`).send({ name: 'Abebe Kebede', email: 'abebe@example.com', message: 'We need a quote for two rock drills.', formStartedAt: Date.now() - 10_000 });
    expect(good.status).toBe(201);
    expect(good.body.reference).toMatch(/^BT-\d{6}-[0-9A-Z]{4}$/);

    const honeypot = await request(app.getHttpServer()).post(`${API}/public/contact`).send({ name: 'Bot Name', email: 'bot@example.com', message: 'Buy now, very long message here.', website: 'http://spam.example' });
    expect(honeypot.status).toBe(201);
    expect(honeypot.body.id).toBeNull();
    expect(await db.contactMessage.count()).toBe(1);

    const invalid = await request(app.getHttpServer()).post(`${API}/public/contact`).send({ name: 'X', email: 'not-an-email', message: 'short' });
    expect(invalid.status).toBe(422);
    expect(invalid.body.details.length).toBeGreaterThan(1);

    const inbox = await writeHeaders(admin().get(`${API}/admin/messages`));
    expect(inbox.body.data).toHaveLength(1);
    expect(inbox.body.meta.counts.NEW).toBe(1);
    const opened = await writeHeaders(admin().get(`${API}/admin/messages/${good.body.id}`));
    expect(opened.body.status).toBe('READ');
    const csv = await writeHeaders(admin().get(`${API}/admin/messages/export.csv`));
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
  });

  it('serves the site bootstrap, sitemap and robots from settings and content', async () => {
    const site = await request(app.getHttpServer()).get(`${API}/public/site`);
    expect(site.status).toBe(200);
    expect(site.body.siteName).toBe('Barathon Trading');
    expect(site.body.footer.copyright).toContain(String(new Date().getUTCFullYear()));
    expect(site.body.menus).toHaveProperty('HEADER');
    const robots = await request(app.getHttpServer()).get(`${API}/public/robots.txt`);
    expect(robots.text).toMatch(/Disallow: \/admin/);
    expect(robots.text).toMatch(/Sitemap: http:\/\/localhost:3000\/sitemap.xml/);
    const sitemap = await request(app.getHttpServer()).get(`${API}/public/sitemap.xml`);
    expect(sitemap.headers['content-type']).toMatch(/application\/xml/);
    expect(sitemap.text).toContain('<loc>http://localhost:3000/about</loc>');
  });

  it('rejects an invalid block and accepts a valid one on a custom page', async () => {
    const page = await writeHeaders(admin().post(`${API}/admin/pages`)).send({ title: 'Privacy Policy' });
    expect(page.status).toBe(201);
    const bad = await writeHeaders(admin().post(`${API}/admin/pages/${page.body.id}/blocks`)).send({ type: 'HERO_CAROUSEL', data: { autoplayMs: 10 } });
    expect(bad.status).toBe(422);
    expect(bad.body.code).toBe('BLOCK_INVALID');
    const good = await writeHeaders(admin().post(`${API}/admin/pages/${page.body.id}/blocks`)).send({ type: 'RICH_TEXT', data: { html: '<p>Hello</p><script>alert(1)</script>' } });
    expect(good.status).toBe(201);
    expect(JSON.stringify(good.body)).not.toContain('<script>');
    expect((await request(app.getHttpServer()).get(`${API}/public/pages/privacy-policy`)).status).toBe(404);
    await writeHeaders(admin().post(`${API}/admin/pages/${page.body.id}/publish`)).send({});
    const live = await request(app.getHttpServer()).get(`${API}/public/pages/privacy-policy`);
    expect(live.status).toBe(200);
    expect(live.body.blocks[0].html).toContain('<p>Hello</p>');
  });
});
