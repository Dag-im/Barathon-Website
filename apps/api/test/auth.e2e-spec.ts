import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createTestApp, resetDatabase, ADMIN_EMAIL, ADMIN_PASSWORD, ORIGIN, cookieValue } from './helpers';
import { PasswordService } from '../src/auth/password.service';

const API = '/api/v1';
const DEFAULT_PASSWORD = 'Reset-Default-2026';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let db: PrismaClient;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    db = new PrismaClient();
  });

  beforeEach(async () => {
    await resetDatabase();
    const passwords = app.get(PasswordService);
    await db.user.create({ data: { email: ADMIN_EMAIL, name: 'Admin', passwordHash: await passwords.hash(ADMIN_PASSWORD) } });
  });

  afterAll(async () => {
    await db.$disconnect();
    await app.close();
  });

  const login = (password = ADMIN_PASSWORD, email = ADMIN_EMAIL) =>
    request(app.getHttpServer()).post(`${API}/auth/login`).set('Origin', ORIGIN).send({ email, password });

  it('signs in, sets HttpOnly cookies and never returns tokens in the body', async () => {
    const res = await login();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(JSON.stringify(res.body)).not.toMatch(/eyJhbGci/);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    const access = cookies.find((c) => c.startsWith('bt_at='));
    const refresh = cookies.find((c) => c.startsWith('bt_rt='));
    const csrf = cookies.find((c) => c.startsWith('bt_csrf='));
    expect(access).toMatch(/HttpOnly/);
    expect(access).toMatch(/SameSite=Lax/);
    expect(refresh).toMatch(/HttpOnly/);
    expect(refresh).toMatch(/SameSite=Strict/);
    expect(refresh).toMatch(/Path=\/api\/v1\/auth/);
    expect(csrf).not.toMatch(/HttpOnly/);
  });

  it('returns the same error for a wrong password and an unknown account', async () => {
    const wrong = await login('nope-nope-nope-1');
    const unknown = await login(ADMIN_PASSWORD, 'ghost@example.com');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.body.code).toBe('INVALID_CREDENTIALS');
    expect(Object.keys(wrong.body).sort()).toEqual(Object.keys(unknown.body).sort());
  });

  it('locks the account after five consecutive failures and records the audit trail', async () => {
    for (let i = 0; i < 5; i++) await login('wrong-password-xx');
    const locked = await login();
    expect(locked.status).toBe(423);
    expect(locked.body.code).toBe('ACCOUNT_LOCKED');
    expect(Number(locked.body.details?.[0]?.message)).toBeGreaterThan(0);
    const actions = (await db.auditLog.findMany({ select: { action: true } })).map((a) => a.action);
    expect(actions.filter((a) => a === 'LOGIN_FAILED').length).toBeGreaterThanOrEqual(5);
    expect(actions).toContain('ACCOUNT_LOCKED');
  });

  it('rotates the refresh token and rejects the old one when reused after the race window', async () => {
    const first = await login();
    const cookies = first.headers['set-cookie'] as unknown as string[];
    const oldRefresh = cookieValue(cookies, 'bt_rt') as string;
    const csrf = cookieValue(cookies, 'bt_csrf') as string;

    const refreshed = await request(app.getHttpServer())
      .post(`${API}/auth/refresh`)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', csrf)
      .set('Cookie', [`bt_rt=${encodeURIComponent(oldRefresh)}`, `bt_csrf=${csrf}`]);
    expect(refreshed.status).toBe(200);
    const newRefresh = cookieValue(refreshed.headers['set-cookie'] as unknown as string[], 'bt_rt');
    expect(newRefresh).toBeTruthy();
    expect(newRefresh).not.toBe(oldRefresh);

    const oldRow = await db.refreshToken.findFirst({ where: { tokenHash: { not: '' }, usedAt: { not: null } } });
    expect(oldRow?.replacedById).toBeTruthy();
    const newRow = await db.refreshToken.findFirst({ where: { parentId: oldRow!.id } });
    expect(newRow).toBeTruthy();
    expect(newRow!.tokenHash).toHaveLength(64);

    // Reuse of the old token well after rotation revokes the whole session.
    await db.refreshToken.update({ where: { id: oldRow!.id }, data: { usedAt: new Date(Date.now() - 60_000) } });
    const reuse = await request(app.getHttpServer())
      .post(`${API}/auth/refresh`)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', csrf)
      .set('Cookie', [`bt_rt=${encodeURIComponent(oldRefresh)}`, `bt_csrf=${csrf}`]);
    expect(reuse.status).toBe(401);
    expect(reuse.body.code).toBe('REFRESH_REUSE');
    const session = await db.authSession.findFirst({ where: { revokedReason: 'REUSE_DETECTED' } });
    expect(session).toBeTruthy();
    const detected = await db.auditLog.count({ where: { action: 'REFRESH_REUSE_DETECTED' } });
    expect(detected).toBe(1);
  });

  it('answers REFRESH_RACE within ten seconds without revoking the session', async () => {
    const first = await login();
    const cookies = first.headers['set-cookie'] as unknown as string[];
    const oldRefresh = cookieValue(cookies, 'bt_rt') as string;
    const csrf = cookieValue(cookies, 'bt_csrf') as string;
    const headers = (rt: string) => [`bt_rt=${encodeURIComponent(rt)}`, `bt_csrf=${csrf}`];
    await request(app.getHttpServer()).post(`${API}/auth/refresh`).set('Origin', ORIGIN).set('X-CSRF-Token', csrf).set('Cookie', headers(oldRefresh));
    const race = await request(app.getHttpServer()).post(`${API}/auth/refresh`).set('Origin', ORIGIN).set('X-CSRF-Token', csrf).set('Cookie', headers(oldRefresh));
    expect(race.status).toBe(401);
    expect(race.body.code).toBe('REFRESH_RACE');
    const session = await db.authSession.findFirst({ where: { revokedAt: null } });
    expect(session).toBeTruthy();
  });

  it('requires the CSRF header on refresh and on unsafe admin requests, and checks the origin', async () => {
    const first = await login();
    const cookies = first.headers['set-cookie'] as unknown as string[];
    const access = cookieValue(cookies, 'bt_at') as string;
    const csrf = cookieValue(cookies, 'bt_csrf') as string;
    const refresh = cookieValue(cookies, 'bt_rt') as string;
    const jar = [`bt_at=${access}`, `bt_csrf=${csrf}`];

    const noCsrfRefresh = await request(app.getHttpServer()).post(`${API}/auth/refresh`).set('Origin', ORIGIN).set('Cookie', [`bt_rt=${encodeURIComponent(refresh)}`]);
    expect(noCsrfRefresh.status).toBe(403);
    expect(noCsrfRefresh.body.code).toBe('CSRF_INVALID');

    const noHeader = await request(app.getHttpServer()).post(`${API}/admin/media-folders`).set('Origin', ORIGIN).set('Cookie', jar).send({ name: 'x' });
    expect(noHeader.status).toBe(403);
    expect(noHeader.body.code).toBe('CSRF_INVALID');

    const mismatch = await request(app.getHttpServer()).post(`${API}/admin/media-folders`).set('Origin', ORIGIN).set('X-CSRF-Token', 'wrong').set('Cookie', jar).send({ name: 'x' });
    expect(mismatch.status).toBe(403);

    const badOrigin = await request(app.getHttpServer()).post(`${API}/admin/media-folders`).set('Origin', 'https://evil.example').set('X-CSRF-Token', csrf).set('Cookie', jar).send({ name: 'x' });
    expect(badOrigin.status).toBe(403);

    const noOrigin = await request(app.getHttpServer()).post(`${API}/admin/media-folders`).set('X-CSRF-Token', csrf).set('Cookie', jar).send({ name: 'x' });
    expect(noOrigin.body.code).toBe('ORIGIN_REQUIRED');

    const ok = await request(app.getHttpServer()).post(`${API}/admin/media-folders`).set('Origin', ORIGIN).set('X-CSRF-Token', csrf).set('Cookie', jar).send({ name: 'Brochures' });
    expect(ok.status).toBe(201);
  });

  it('rejects unsigned or foreign access tokens and expired-looking garbage', async () => {
    const forged = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: 'x', sid: 'y', tv: 0 })).toString('base64url') + '.';
    const res = await request(app.getHttpServer()).get(`${API}/auth/me`).set('Cookie', [`bt_at=${forged}`]);
    expect(res.status).toBe(401);
    const none = await request(app.getHttpServer()).get(`${API}/auth/me`);
    expect(none.body.code).toBe('UNAUTHENTICATED');
  });

  it('forgot-password resets to the constant, forces a change, and blocks admin routes until changed', async () => {
    const unknown = await request(app.getHttpServer()).post(`${API}/auth/forgot-password`).set('Origin', ORIGIN).send({ identifier: 'ghost@example.com' });
    const known = await request(app.getHttpServer()).post(`${API}/auth/forgot-password`).set('Origin', ORIGIN).send({ identifier: ADMIN_EMAIL });
    expect(unknown.status).toBe(200);
    expect(known.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    expect(known.body.message).toMatch(/reset to the default password/);

    const reset = await login(DEFAULT_PASSWORD);
    expect(reset.status).toBe(200);
    expect(reset.body.mustChangePassword).toBe(true);
    const cookies = reset.headers['set-cookie'] as unknown as string[];
    const access = cookieValue(cookies, 'bt_at') as string;
    const csrf = cookieValue(cookies, 'bt_csrf') as string;
    const jar = [`bt_at=${access}`, `bt_csrf=${csrf}`];

    const blocked = await request(app.getHttpServer()).get(`${API}/admin/products`).set('Cookie', jar);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const me = await request(app.getHttpServer()).get(`${API}/auth/me`).set('Cookie', jar);
    expect(me.status).toBe(200);
    expect(me.body.mustChangePassword).toBe(true);

    const sameAsDefault = await request(app.getHttpServer()).post(`${API}/auth/change-password`).set('Origin', ORIGIN).set('X-CSRF-Token', csrf).set('Cookie', jar).send({ newPassword: DEFAULT_PASSWORD });
    expect(sameAsDefault.status).toBe(422);

    const weak = await request(app.getHttpServer()).post(`${API}/auth/change-password`).set('Origin', ORIGIN).set('X-CSRF-Token', csrf).set('Cookie', jar).send({ newPassword: 'short' });
    expect(weak.status).toBe(422);

    const changed = await request(app.getHttpServer()).post(`${API}/auth/change-password`).set('Origin', ORIGIN).set('X-CSRF-Token', csrf).set('Cookie', jar).send({ newPassword: 'Fresh-Passphrase-42' });
    expect(changed.status).toBe(204);
    const newCookies = changed.headers['set-cookie'] as unknown as string[];
    const jar2 = [`bt_at=${cookieValue(newCookies, 'bt_at')}`, `bt_csrf=${cookieValue(newCookies, 'bt_csrf')}`];
    const open = await request(app.getHttpServer()).get(`${API}/admin/products`).set('Cookie', jar2);
    expect(open.status).toBe(200);

    const oldPassword = await login(DEFAULT_PASSWORD);
    expect(oldPassword.status).toBe(401);
    const newPassword = await login('Fresh-Passphrase-42');
    expect(newPassword.status).toBe(200);
    expect(newPassword.body.mustChangePassword).toBe(false);
  });

  it('logout clears the session so the old access cookie no longer works', async () => {
    const first = await login();
    const cookies = first.headers['set-cookie'] as unknown as string[];
    const access = cookieValue(cookies, 'bt_at') as string;
    const csrf = cookieValue(cookies, 'bt_csrf') as string;
    const jar = [`bt_at=${access}`, `bt_csrf=${csrf}`];
    const out = await request(app.getHttpServer()).post(`${API}/auth/logout`).set('Origin', ORIGIN).set('X-CSRF-Token', csrf).set('Cookie', jar);
    expect(out.status).toBe(204);
    const me = await request(app.getHttpServer()).get(`${API}/auth/me`).set('Cookie', jar);
    expect(me.status).toBe(401);
  });
});
