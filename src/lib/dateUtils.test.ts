import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDateToString, getLocalDateString } from './dateUtils';

describe('dateUtils.getLocalDateString', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns a zero-padded YYYY-MM-DD local date string', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 7, 9, 15, 0)); // Local time: Feb 7, 2026

    expect(getLocalDateString()).toBe('2026-02-07');
  });

  it('resolves local date across UTC boundary (2026-02-27T23:30:00Z -> 2026-02-28 in UTC+1)', () => {
    const RealDate = Date;

    class MockDate extends RealDate {
      constructor(...args: ConstructorParameters<typeof RealDate>) {
        if (args.length === 0) {
          super('2026-02-27T23:30:00.000Z');
          return;
        }
        super(...args);
      }

      getFullYear(): number {
        return 2026;
      }

      getMonth(): number {
        return 1;
      }

      getDate(): number {
        return 28;
      }
    }

    vi.stubGlobal('Date', MockDate);

    expect(getLocalDateString()).toBe('2026-02-28');
  });
});

describe('dateUtils.formatDateToString', () => {
  it('formats Date objects as zero-padded YYYY-MM-DD', () => {
    expect(formatDateToString(new Date(2026, 1, 7))).toBe('2026-02-07');
  });
});
