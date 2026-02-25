import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './useAuthStore';

const { toastErrorMock, supabaseMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  supabaseMock: {
    rpc: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: supabaseMock,
}));

describe('useAuthStore.checkAdminStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.setState({ ...useAuthStore.getState(), currentUser: null, isLoading: false });
  });

  it('returns false when there is no current user', async () => {
    const result = await useAuthStore.getState().checkAdminStatus();

    expect(result).toBe(false);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('returns true for an admin and updates the user state', async () => {
    useAuthStore.setState({
      ...useAuthStore.getState(),
      currentUser: { id: 'user-1', isAdmin: false },
    });
    supabaseMock.rpc.mockResolvedValueOnce({ data: true, error: null });

    const result = await useAuthStore.getState().checkAdminStatus();

    expect(result).toBe(true);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('is_admin', { id: 'user-1' });
    expect(useAuthStore.getState().currentUser).toEqual({ id: 'user-1', isAdmin: true });
  });

  it('returns false for a non-admin user', async () => {
    useAuthStore.setState({
      ...useAuthStore.getState(),
      currentUser: { id: 'user-2', isAdmin: true },
    });
    supabaseMock.rpc.mockResolvedValueOnce({ data: false, error: null });

    const result = await useAuthStore.getState().checkAdminStatus();

    expect(result).toBe(false);
    expect(useAuthStore.getState().currentUser).toEqual({ id: 'user-2', isAdmin: false });
  });

  it('returns false and toasts on RPC error', async () => {
    useAuthStore.setState({
      ...useAuthStore.getState(),
      currentUser: { id: 'user-3', isAdmin: false },
    });
    supabaseMock.rpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc failed' } });

    const result = await useAuthStore.getState().checkAdminStatus();

    expect(result).toBe(false);
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
  });
});
