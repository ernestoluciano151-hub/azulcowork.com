
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/server', () => ({
  NextResponse: { json: vi.fn((b, i) => ({ body: b, status: i?.status ?? 200 })) }
}));
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({ get: vi.fn(() => undefined), set: vi.fn() }))
}));
vi.mock('jose', () => ({
  SignJWT: vi.fn(),
  jwtVerify: vi.fn(async () => { throw new Error('no token'); })
}));

import { requireSession } from '@/lib/auth';

describe('auth smoke', () => {
  it('returns 401 with no session', async () => {
    const r = await requireSession();
    expect(r.session).toBeNull();
  });
});
