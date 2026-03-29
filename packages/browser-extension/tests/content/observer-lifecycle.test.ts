import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests for observer cleanup behavior on navigation.
 *
 * Since activateFeatures is internal to index.ts, we test the extracted
 * createObserverLifecycle helper that manages observer references and
 * disconnect-on-abort behavior.
 */
import {
  createObserverLifecycle,
  type ObserverLifecycle,
} from '../../src/content/observer-lifecycle';

describe('createObserverLifecycle', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should return an ObserverLifecycle with an abort controller', () => {
    const lifecycle = createObserverLifecycle();
    expect(lifecycle.signal).toBeInstanceOf(AbortSignal);
    expect(lifecycle.signal.aborted).toBe(false);
  });

  it('should track registered observers', () => {
    const lifecycle = createObserverLifecycle();
    const observer = new MutationObserver(() => {});
    lifecycle.trackObserver(observer);

    // Should not throw
    lifecycle.abort();
    expect(lifecycle.signal.aborted).toBe(true);
  });

  it('should disconnect all tracked observers on abort', () => {
    const lifecycle = createObserverLifecycle();

    const disconnect1 = vi.fn();
    const disconnect2 = vi.fn();
    const observer1 = new MutationObserver(() => {});
    const observer2 = new MutationObserver(() => {});
    observer1.disconnect = disconnect1;
    observer2.disconnect = disconnect2;

    lifecycle.trackObserver(observer1);
    lifecycle.trackObserver(observer2);

    lifecycle.abort();

    expect(disconnect1).toHaveBeenCalledTimes(1);
    expect(disconnect2).toHaveBeenCalledTimes(1);
  });

  it('should clear pending timers on abort', () => {
    vi.useFakeTimers();
    const lifecycle = createObserverLifecycle();
    const callback = vi.fn();

    const timerId = setTimeout(callback, 1000);
    lifecycle.trackTimer(timerId);

    lifecycle.abort();

    vi.advanceTimersByTime(2000);
    expect(callback).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('should abort the signal when abort() is called', () => {
    const lifecycle = createObserverLifecycle();
    const abortHandler = vi.fn();
    lifecycle.signal.addEventListener('abort', abortHandler);

    lifecycle.abort();

    expect(lifecycle.signal.aborted).toBe(true);
    expect(abortHandler).toHaveBeenCalledTimes(1);
  });

  it('should create a new lifecycle that aborts the previous one', () => {
    const lifecycle1 = createObserverLifecycle();
    const disconnect = vi.fn();
    const observer = new MutationObserver(() => {});
    observer.disconnect = disconnect;
    lifecycle1.trackObserver(observer);

    // Simulate re-initialization: abort old, create new
    lifecycle1.abort();
    const lifecycle2 = createObserverLifecycle();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(lifecycle2.signal.aborted).toBe(false);
  });

  it('should handle abort called multiple times gracefully', () => {
    const lifecycle = createObserverLifecycle();
    const disconnect = vi.fn();
    const observer = new MutationObserver(() => {});
    observer.disconnect = disconnect;
    lifecycle.trackObserver(observer);

    lifecycle.abort();
    lifecycle.abort(); // second call should not throw

    // disconnect called only once because AbortController only fires once
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
