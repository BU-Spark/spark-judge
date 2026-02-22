import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Id } from '../../../../convex/_generated/dataModel';
import { ensureSeedAdminUser } from '../../../../convex/seeds/shared/auth';

vi.mock('@convex-dev/auth/server', () => ({
  getAuthUserId: vi.fn(),
}));

describe('ensureSeedAdminUser', () => {
  const mockCtx = {
    db: {
      get: vi.fn(),
      insert: vi.fn(),
      patch: vi.fn(),
    },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a seed admin when no auth user exists', async () => {
    const { getAuthUserId } = await import('@convex-dev/auth/server');
    vi.mocked(getAuthUserId).mockResolvedValue(null);
    mockCtx.db.insert.mockResolvedValue('new_user' as Id<'users'>);

    const userId = await ensureSeedAdminUser(mockCtx);

    expect(userId).toBe('new_user');
    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      'users',
      expect.objectContaining({
        name: 'Demo Admin',
        email: 'admin@demo.com',
      })
    );
    expect(mockCtx.db.patch).toHaveBeenCalledWith('new_user', { isAdmin: true });
  });

  it('ignores fake dashboard auth IDs and creates a seed admin', async () => {
    const { getAuthUserId } = await import('@convex-dev/auth/server');
    vi.mocked(getAuthUserId).mockResolvedValue('fake_id' as Id<'users'>);
    mockCtx.db.insert.mockResolvedValue('seed_user' as Id<'users'>);

    const userId = await ensureSeedAdminUser(mockCtx);

    expect(userId).toBe('seed_user');
    expect(mockCtx.db.get).not.toHaveBeenCalled();
    expect(mockCtx.db.insert).toHaveBeenCalledTimes(1);
    expect(mockCtx.db.patch).toHaveBeenCalledWith('seed_user', { isAdmin: true });
  });

  it('uses authenticated user when user record exists', async () => {
    const { getAuthUserId } = await import('@convex-dev/auth/server');
    const authUserId = 'auth_user' as Id<'users'>;
    vi.mocked(getAuthUserId).mockResolvedValue(authUserId);
    mockCtx.db.get.mockResolvedValue({ _id: authUserId, email: 'user@demo.com' });

    const userId = await ensureSeedAdminUser(mockCtx);

    expect(userId).toBe(authUserId);
    expect(mockCtx.db.insert).not.toHaveBeenCalled();
    expect(mockCtx.db.patch).toHaveBeenCalledWith(authUserId, { isAdmin: true });
  });

  it('creates a seed admin when auth user is missing from db', async () => {
    const { getAuthUserId } = await import('@convex-dev/auth/server');
    const authUserId = 'auth_missing' as Id<'users'>;
    vi.mocked(getAuthUserId).mockResolvedValue(authUserId);
    mockCtx.db.get.mockResolvedValue(null);
    mockCtx.db.insert.mockResolvedValue('replacement_user' as Id<'users'>);

    const userId = await ensureSeedAdminUser(mockCtx, {
      name: 'Prize Flow Seed Admin',
      email: 'prize@example.com',
    });

    expect(userId).toBe('replacement_user');
    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      'users',
      expect.objectContaining({
        name: 'Prize Flow Seed Admin',
        email: 'prize@example.com',
      })
    );
    expect(mockCtx.db.patch).toHaveBeenCalledWith('replacement_user', {
      isAdmin: true,
    });
  });
});
