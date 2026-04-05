import type { Uri } from 'vscode';

export type DocumentSide = 'LEFT' | 'RIGHT' | 'BOTH';

/**
 * Detect whether a document URI represents the LEFT (old) or RIGHT (new)
 * side of a diff view.
 * - git: scheme → LEFT (old version in a diff view)
 * - file: scheme → RIGHT (new version / normal file)
 * - Other/unknown → BOTH (show all comments)
 *
 * Used for:
 * - Posting: detecting which side the cursor is on
 * - Sidebar: showing [Old]/[New] indicators
 * - Diff rendering: filtering comments per-side when paired editor detected
 */
export function detectDocumentSide(uri: Uri): DocumentSide {
  if (uri.scheme === 'git') return 'LEFT';
  if (uri.scheme === 'file') return 'RIGHT';
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
