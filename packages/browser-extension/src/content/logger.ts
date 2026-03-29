/**
 * Debug logger for Gitnotate.
 *
 * Logs are suppressed by default. Enable via:
 * - Browser console: `localStorage.setItem('gitnotate-debug', 'true')`
 * - Or set `GITNOTATE_DEBUG=true` in the extension's storage
 *
 * Disable: `localStorage.removeItem('gitnotate-debug')`
 */

let debugEnabled: boolean | null = null;

function isDebugEnabled(): boolean {
  if (debugEnabled !== null) return debugEnabled;
  try {
    debugEnabled = localStorage.getItem('gitnotate-debug') === 'true';
  } catch {
    debugEnabled = false;
  }
  return debugEnabled;
}

export function debug(...args: unknown[]): void {
  if (isDebugEnabled()) {
    console.log('[Gitnotate]', ...args);
  }
}

/** Force re-check of debug flag (e.g. after toggling in console). */
export function resetDebugFlag(): void {
  debugEnabled = null;
}
