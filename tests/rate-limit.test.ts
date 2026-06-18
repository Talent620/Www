import { describe, it, expect } from 'vitest';
import { RateLimiter, enforceRateLimit, clientKey } from '@/lib/security/rate-limit';

describe('RateLimiter', () => {
  it('allows up to the limit then blocks within a window', () => {
    let now = 1000;
    const rl = new RateLimiter(() => now);
    const res = Array.from({ length: 4 }, () => rl.check('k', 3, 1000));
    expect(res.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(res[2]!.remaining).toBe(0);
    expect(res[3]!.resetMs).toBeGreaterThan(0);
  });

  it('resets after the window elapses', () => {
    let now = 0;
    const rl = new RateLimiter(() => now);
    expect(rl.check('k', 1, 1000).allowed).toBe(true);
    expect(rl.check('k', 1, 1000).allowed).toBe(false);
    now += 1001;
    expect(rl.check('k', 1, 1000).allowed).toBe(true);
  });

  it('tracks keys independently', () => {
    let now = 0;
    const rl = new RateLimiter(() => now);
    expect(rl.check('a', 1, 1000).allowed).toBe(true);
    expect(rl.check('b', 1, 1000).allowed).toBe(true);
    expect(rl.check('a', 1, 1000).allowed).toBe(false);
  });
});

describe('clientKey', () => {
  it('reads the first x-forwarded-for hop', () => {
    const req = new Request('http://x', { headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' } });
    expect(clientKey(req)).toBe('203.0.113.7');
  });

  it('falls back to anonymous', () => {
    expect(clientKey(new Request('http://x'))).toBe('anonymous');
  });
});

describe('enforceRateLimit', () => {
  it('returns null while allowed and a 429 once exceeded', async () => {
    const make = () => new Request('http://x', { headers: { 'x-forwarded-for': '198.51.100.5' } });
    // Default limiter is shared; use a unique bucket so other tests don't interfere.
    const bucket = `test-${Math.random()}`;
    expect(enforceRateLimit(make(), bucket, 1, 60_000)).toBeNull();
    const blocked = enforceRateLimit(make(), bucket, 1, 60_000);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    expect(blocked!.headers.get('Retry-After')).toBeTruthy();
    const body = await blocked!.json();
    expect(body.error).toMatch(/too many/i);
  });
});
