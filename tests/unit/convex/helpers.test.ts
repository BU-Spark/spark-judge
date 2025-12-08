import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isAdmin, requireAuth, requireAdmin } from '../../../convex/helpers';
import { Id } from '../../../convex/_generated/dataModel';

// Mock the auth module
vi.mock('@convex-dev/auth/server', () => ({
  getAuthUserId: vi.fn(),
}));

describe('helpers', () => {
  const mockCtx = {
    db: {
      get: vi.fn(),
    },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isAdmin', () => {
    it('should return false when user is not authenticated', async () => {
      const { getAuthUserId } = await import('@convex-dev/auth/server');
      vi.mocked(getAuthUserId).mockResolvedValue(null);

      const result = await isAdmin(mockCtx);
      expect(result).toBe(false);
    });

    it('should return false when user does not exist', async () => {
      const { getAuthUserId } = await import('@convex-dev/auth/server');
      const userId = 'user123' as Id<'users'>;
      vi.mocked(getAuthUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue(null);

      const result = await isAdmin(mockCtx);
      expect(result).toBe(false);
    });

    it('should return false when user is not admin', async () => {
      const { getAuthUserId } = await import('@convex-dev/auth/server');
      const userId = 'user123' as Id<'users'>;
      vi.mocked(getAuthUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({ _id: userId, isAdmin: false });

      const result = await isAdmin(mockCtx);
      expect(result).toBe(false);
    });

    it('should return true when user is admin', async () => {
      const { getAuthUserId } = await import('@convex-dev/auth/server');
      const userId = 'user123' as Id<'users'>;
      vi.mocked(getAuthUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({ _id: userId, isAdmin: true });

      const result = await isAdmin(mockCtx);
      expect(result).toBe(true);
    });
  });

  describe('requireAuth', () => {
    it('should throw error when user is not authenticated', async () => {
      const { getAuthUserId } = await import('@convex-dev/auth/server');
      vi.mocked(getAuthUserId).mockResolvedValue(null);

      await expect(requireAuth(mockCtx)).rejects.toThrow('Not authenticated');
    });

    it('should return userId when user is authenticated', async () => {
      const { getAuthUserId } = await import('@convex-dev/auth/server');
      const userId = 'user123' as Id<'users'>;
      vi.mocked(getAuthUserId).mockResolvedValue(userId);

      const result = await requireAuth(mockCtx);
      expect(result).toBe(userId);
    });
  });

  describe('requireAdmin', () => {
    it('should throw error when user is not authenticated', async () => {
      const { getAuthUserId } = await import('@convex-dev/auth/server');
      vi.mocked(getAuthUserId).mockResolvedValue(null);

      await expect(requireAdmin(mockCtx)).rejects.toThrow('Not authenticated');
    });

    it('should throw error when user is not admin', async () => {
      const { getAuthUserId } = await import('@convex-dev/auth/server');
      const userId = 'user123' as Id<'users'>;
      vi.mocked(getAuthUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({ _id: userId, isAdmin: false });

      await expect(requireAdmin(mockCtx)).rejects.toThrow(
        'Not authorized - admin access required'
      );
    });

    it('should return userId when user is admin', async () => {
      const { getAuthUserId } = await import('@convex-dev/auth/server');
      const userId = 'user123' as Id<'users'>;
      vi.mocked(getAuthUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({ _id: userId, isAdmin: true });

      const result = await requireAdmin(mockCtx);
      expect(result).toBe(userId);
    });

    it('should throw error when user does not have isAdmin field', async () => {
      const { getAuthUserId } = await import('@convex-dev/auth/server');
      const userId = 'user123' as Id<'users'>;
      vi.mocked(getAuthUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({ _id: userId });

      await expect(requireAdmin(mockCtx)).rejects.toThrow(
        'Not authorized - admin access required'
      );
    });
  });
});
