import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdminStatus, isAdminUser, resetAllVotes } from './adminService';

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    rpc: vi.fn(),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: supabaseMock,
}));

describe('adminService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true for known admin user id', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: true, error: null });

    await expect(isAdminUser('admin-user-id')).resolves.toBe(true);
  });

  it('returns false for non-admin user id', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: false, error: null });

    await expect(isAdminUser('normal-user-id')).resolves.toBe(false);
  });

  it('returns false when user id is null or missing', async () => {
    await expect(isAdminUser(null)).resolves.toBe(false);
    await expect(isAdminUser(undefined)).resolves.toBe(false);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('returns admin status error metadata from getAdminStatus', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc failed' } });

    await expect(getAdminStatus('user-id')).resolves.toEqual({
      isAdmin: false,
      error: 'rpc failed',
    });
  });

  it('calls reset_all_votes and succeeds', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ error: null });

    await expect(resetAllVotes()).resolves.toEqual({ success: true });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('reset_all_votes');
  });

  it('returns an error when reset_all_votes fails', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ error: { message: 'permission denied' } });

    await expect(resetAllVotes()).resolves.toEqual({
      success: false,
      error: 'permission denied',
    });
  });
});
