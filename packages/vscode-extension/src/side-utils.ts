import type { Uri } from 'vscode';

export type DocumentSide = 'LEFT' | 'RIGHT' | 'BOTH';

/**
 * Detect whether a document URI represents the LEFT (old) or RIGHT (new)
 * side of a diff view.
 * - git: scheme → LEFT (old version in a diff view)
 * - file: scheme → RIGHT (new version / normal file)
 * - Other/unknown → BOTH (show all comments)
 *
 * Note: For RENDERING, diff views always use BOTH — we show all comments
 * regardless of side because VSCode's diff editor doesn't reliably fire
 * editor-change events when switching between panes. Side filtering would
 * cause comments to disappear. The side metadata is still used for:
 * - Posting: detecting which side the cursor is on
 * - Sidebar: showing [Old]/[New] indicators
 */
export function detectDocumentSide(uri: Uri): DocumentSide {
  if (uri.scheme === 'git') return 'LEFT';
  if (uri.scheme === 'file') return 'RIGHT';
  return 'BOTH';
}

/**
 * Determine whether to filter comments by side during rendering.
 * In diff views (git: scheme), we show ALL comments to avoid
 * hiding comments when the user can't switch panes to see them.
 * In normal file views (file: scheme), we also show all — the
 * side metadata is used for posting and display, not filtering.
 */
export function detectRenderingSide(uri: Uri): DocumentSide {
  // Always render all comments — side filtering causes comments
  // to disappear in diff views where pane switching doesn't trigger
  // editor change events reliably.
  return 'BOTH';
}

/**
 * Normalize side values from different sources.
 * ^gn metadata uses 'L'/'R', GitHub API uses 'LEFT'/'RIGHT'.
 */
export function normalizeSide(side: string): 'LEFT' | 'RIGHT' {
  if (side === 'L' || side === 'LEFT') return 'LEFT';
  return 'RIGHT';
}
