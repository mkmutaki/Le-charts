import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDeviceIdStorageKey, getOrCreateDeviceId, isValidDeviceId } from './deviceId';

type MockStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

function createMockStorage(initial: Record<string, string> = {}): MockStorage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
  };
}

describe('deviceId', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', createMockStorage());
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(),
    });
  });

  it('generates and stores a device ID on first visit', () => {
    const uuid = 'a55dc711-c53f-4f7c-9e97-e3c62f316a43';
    vi.mocked(crypto.randomUUID).mockReturnValueOnce(uuid);

    const result = getOrCreateDeviceId();

    expect(result).toBe(uuid);
    expect(localStorage.getItem(getDeviceIdStorageKey())).toBe(uuid);
  });

  it('reuses the stored namespaced device ID on subsequent visits', () => {
    const existingUuid = '8f09bec1-d704-4fcf-909d-6fd0f978698f';
    vi.stubGlobal(
      'localStorage',
      createMockStorage({ [getDeviceIdStorageKey()]: existingUuid })
    );

    const result = getOrCreateDeviceId();

    expect(result).toBe(existingUuid);
    expect(crypto.randomUUID).not.toHaveBeenCalled();
  });

  it('migrates a valid legacy device_id key to the namespaced key', () => {
    const legacyUuid = '5e53e788-df52-4f83-9c8e-df5d7f8c12a0';
    vi.stubGlobal('localStorage', createMockStorage({ device_id: legacyUuid }));

    const result = getOrCreateDeviceId();

    expect(result).toBe(legacyUuid);
    expect(localStorage.getItem(getDeviceIdStorageKey())).toBe(legacyUuid);
  });

  it('replaces empty or malformed stored IDs with a new valid UUID', () => {
    vi.stubGlobal(
      'localStorage',
      createMockStorage({ [getDeviceIdStorageKey()]: '', device_id: 'not-a-uuid' })
    );
    const newUuid = '3f1ae7cb-ab91-4dea-9470-8e517c4f2f50';
    vi.mocked(crypto.randomUUID).mockReturnValueOnce(newUuid);

    const result = getOrCreateDeviceId();

    expect(result).toBe(newUuid);
    expect(localStorage.getItem(getDeviceIdStorageKey())).toBe(newUuid);
    expect(localStorage.getItem('device_id')).toBeNull();
  });

  it('produces a valid UUID v4 format', () => {
    const generatedUuid = 'c2f9f9b4-65cf-4af4-aecb-a20e1f203200';
    vi.mocked(crypto.randomUUID).mockReturnValueOnce(generatedUuid);

    const result = getOrCreateDeviceId();

    expect(isValidDeviceId(result)).toBe(true);
  });
});
