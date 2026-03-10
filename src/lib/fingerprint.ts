function bytesToLowerHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function getClientFingerprint(): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    return null;
  }

  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const language = navigator.language;
  const screenResolution = `${screen.width}x${screen.height}`;
  const rawFingerprint = [
    userAgent,
    platform,
    timeZone,
    language,
    screenResolution,
  ].join('|');

  const digest = await subtle.digest(
    'SHA-256',
    new TextEncoder().encode(rawFingerprint),
  );

  return bytesToLowerHex(new Uint8Array(digest));
}
