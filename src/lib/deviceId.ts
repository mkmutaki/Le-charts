import { v4 as uuidv4 } from 'uuid';

const DEVICE_ID_KEY = 'lecharts:deviceId';
const LEGACY_DEVICE_ID_KEY = 'device_id';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures and continue with in-memory value.
  }
}

function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

function generateDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return uuidv4();
}

export function isValidDeviceId(value: string | null | undefined): value is string {
  return Boolean(value && UUID_V4_REGEX.test(value));
}

export function getOrCreateDeviceId(): string {
  const namespacedDeviceId = readStorage(DEVICE_ID_KEY);
  if (isValidDeviceId(namespacedDeviceId)) {
    return namespacedDeviceId;
  }

  const legacyDeviceId = readStorage(LEGACY_DEVICE_ID_KEY);
  if (isValidDeviceId(legacyDeviceId)) {
    writeStorage(DEVICE_ID_KEY, legacyDeviceId);
    return legacyDeviceId;
  }

  const newDeviceId = generateDeviceId();
  writeStorage(DEVICE_ID_KEY, newDeviceId);
  removeStorage(LEGACY_DEVICE_ID_KEY);
  return newDeviceId;
}

export function getDeviceIdStorageKey(): string {
  return DEVICE_ID_KEY;
}
