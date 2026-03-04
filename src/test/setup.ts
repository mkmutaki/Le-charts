import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './server';

vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co');
vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-anon-key');

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
  try {
    localStorage.clear();
  } catch {
    // Ignore localStorage access issues in tests that stub it.
  }
  vi.restoreAllMocks();
});

afterAll(() => {
  server.close();
});
