/**
 * Manages MutationObserver references and timers, disconnecting/clearing
 * them all when the lifecycle is aborted (e.g. on Turbo navigation).
 */

export interface ObserverLifecycle {
  /** The AbortSignal for DOM event listeners. */
  signal: AbortSignal;
  /** Register a MutationObserver to be disconnected on abort. */
  trackObserver(observer: MutationObserver): void;
  /** Register a timer to be cleared on abort. */
  trackTimer(timerId: ReturnType<typeof setTimeout>): void;
  /** Abort: disconnect all observers, clear all timers, fire the signal. */
  abort(): void;
}

export function createObserverLifecycle(): ObserverLifecycle {
  const controller = new AbortController();
  const observers: MutationObserver[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];

  controller.signal.addEventListener('abort', () => {
    for (const obs of observers) {
      obs.disconnect();
    }
    for (const t of timers) {
      clearTimeout(t);
    }
    observers.length = 0;
    timers.length = 0;
  });

  return {
    signal: controller.signal,

    trackObserver(observer: MutationObserver): void {
      observers.push(observer);
    },

    trackTimer(timerId: ReturnType<typeof setTimeout>): void {
      timers.push(timerId);
    },

    abort(): void {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    },
  };
}
