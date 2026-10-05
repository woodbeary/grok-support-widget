/** @jest-environment node */
import { createAdminToken, passwordMatches, verifyAdminToken } from '../admin-session';
import { isValidSessionId, newSessionId } from '../session-id';

describe('admin sessions', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, ADMIN_PASSWORD: 'correct horse' };
    delete process.env.ADMIN_SESSION_SECRET;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('accepts a token it signed', async () => {
    const token = await createAdminToken();
    expect(token).not.toBeNull();
    expect(await verifyAdminToken(token!)).toBe(true);
  });

  it('rejects the old static cookie and tampered tokens', async () => {
    const token = (await createAdminToken())!;
    const [expires, signature] = token.split('.');
    const flipped = signature.slice(0, -1) + (signature.endsWith('0') ? '1' : '0');

    expect(await verifyAdminToken('valid')).toBe(false);
    expect(await verifyAdminToken(`${Number(expires) + 60_000}.${signature}`)).toBe(false);
    expect(await verifyAdminToken(`${expires}.${flipped}`)).toBe(false);
  });

  it('rejects expired tokens', async () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const token = await createAdminToken(twoHoursAgo);
    expect(await verifyAdminToken(token!)).toBe(false);
  });

  it('logs everyone out when the password changes', async () => {
    const token = await createAdminToken();
    process.env.ADMIN_PASSWORD = 'battery staple';
    expect(await verifyAdminToken(token!)).toBe(false);
  });

  it('stays locked when no password is configured', async () => {
    delete process.env.ADMIN_PASSWORD;
    expect(await createAdminToken()).toBeNull();
    expect(await verifyAdminToken('9999999999999.abc')).toBe(false);
  });

  it('compares passwords exactly', async () => {
    expect(await passwordMatches('correct horse', 'correct horse')).toBe(true);
    expect(await passwordMatches('correct hors', 'correct horse')).toBe(false);
    expect(await passwordMatches('', 'correct horse')).toBe(false);
  });
});

describe('session IDs', () => {
  it('accepts generated IDs', () => {
    expect(isValidSessionId(newSessionId())).toBe(true);
  });

  it.each(['../../package', 'a/b/c/d/e', '..%2F..%2Fx', '', 'short', 'x'.repeat(81), undefined, 42])(
    'rejects %p',
    (id) => {
      expect(isValidSessionId(id)).toBe(false);
    },
  );
});
