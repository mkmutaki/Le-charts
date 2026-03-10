import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getClientFingerprint } from './fingerprint';

function createDigestResult(bytes: number[]): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

describe('getClientFingerprint', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'UA-Test',
    });
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'Platform-Test',
    });
    Object.defineProperty(navigator, 'language', {
      configurable: true,
      value: 'en-KE',
    });
    Object.defineProperty(screen, 'width', {
      configurable: true,
      value: 1920,
    });
    Object.defineProperty(screen, 'height', {
      configurable: true,
      value: 1080,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('passes the expected pipe-delimited signal string to subtle.digest', async () => {
    const digestMock = vi.fn(async (_algorithm: string, data: BufferSource) => {
      const encoded = data as ArrayBufferView;
      const decoded = new TextDecoder().decode(encoded);
      expect(decoded).toBe('UA-Test|Platform-Test|Africa/Nairobi|en-KE|1920x1080');
      return createDigestResult([0, 1, 2, 3]);
    });

    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Africa/Nairobi' }),
    } as Intl.DateTimeFormat);

    vi.stubGlobal('crypto', {
      subtle: {
        digest: digestMock,
      },
    });

    await getClientFingerprint();

    expect(digestMock).toHaveBeenCalledTimes(1);
    expect(digestMock.mock.calls[0]?.[0]).toBe('SHA-256');
  });

  it('returns digest bytes as a lowercase hex string', async () => {
    const digestMock = vi.fn().mockResolvedValue(createDigestResult([0, 15, 171, 255]));

    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'UTC' }),
    } as Intl.DateTimeFormat);

    vi.stubGlobal('crypto', {
      subtle: {
        digest: digestMock,
      },
    });

    const fingerprint = await getClientFingerprint();

    expect(fingerprint).toBe('000fabff');
  });

  it('returns null when SubtleCrypto is unavailable', async () => {
    vi.stubGlobal('crypto', {});

    const fingerprint = await getClientFingerprint();

    expect(fingerprint).toBeNull();
  });
});
