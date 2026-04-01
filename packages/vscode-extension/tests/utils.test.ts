import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from '../src/utils';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should delay invocation until after the wait period', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('should reset the timer on subsequent calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    vi.advanceTimersByTime(200);
    debounced(); // resets timer
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('should pass the latest arguments to the function', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('first');
    debounced('second');
    debounced('third');

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith('third');
  });

  it('should provide a dispose method that cancels pending invocation', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    vi.advanceTimersByTime(100);
    debounced.dispose();
    vi.advanceTimersByTime(300);

    expect(fn).not.toHaveBeenCalled();
  });

  it('should be safe to call dispose multiple times', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced.dispose();
    debounced.dispose(); // should not throw

    expect(fn).not.toHaveBeenCalled();
  });

  it('should not invoke after dispose even if called again', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced.dispose();
    debounced();
    vi.advanceTimersByTime(200);

    // After dispose, the debounced function is a no-op
    expect(fn).not.toHaveBeenCalled();
  });
});
