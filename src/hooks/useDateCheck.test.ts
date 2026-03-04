import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDateCheck } from './useDateCheck';

describe('useDateCheck', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('detects midnight transition while app remains open', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 27, 23, 59, 30));
    const onDateChange = vi.fn();

    const { result } = renderHook(() =>
      useDateCheck({ checkInterval: 1000, onDateChange })
    );

    expect(result.current.currentDate).toBe('2026-02-27');
    expect(result.current.hasDateChanged).toBe(false);

    act(() => {
      vi.advanceTimersByTime(40_000);
    });

    expect(result.current.currentDate).toBe('2026-02-28');
    expect(result.current.hasDateChanged).toBe(true);

    expect(onDateChange).toHaveBeenCalledWith('2026-02-28', '2026-02-27');
  });

  it('resets the date-change flag after handling', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 27, 23, 59, 59));

    const { result } = renderHook(() => useDateCheck({ checkInterval: 500 }));

    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    expect(result.current.hasDateChanged).toBe(true);

    act(() => {
      result.current.resetDateCheck();
    });

    expect(result.current.hasDateChanged).toBe(false);
  });
});
