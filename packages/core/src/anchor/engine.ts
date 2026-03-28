import type { TextQuoteSelector } from '../schema/types';

export interface AnchorMatch {
  start: number;
  end: number;
  exact: string;
  confidence: number;
}

// ── helpers ──────────────────────────────────────────────────────────

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ');
}

/** Find every index where `needle` appears in `haystack`. */
function findAllExactIndices(haystack: string, needle: string): number[] {
  const indices: number[] = [];
  let pos = 0;
  while (pos <= haystack.length - needle.length) {
    const idx = haystack.indexOf(needle, pos);
    if (idx === -1) break;
    indices.push(idx);
    pos = idx + 1;
  }
  return indices;
}

/**
 * Score how well a candidate match's surrounding context aligns with the
 * selector's prefix / suffix.  Returns 0‑1.
 */
function scoreContext(
  selector: TextQuoteSelector,
  documentText: string,
  matchStart: number,
  matchEnd: number,
): number {
  let total = 0;
  let earned = 0;

  if (selector.prefix) {
    const pLen = selector.prefix.length;
    total += pLen;
    const before = documentText.substring(
      Math.max(0, matchStart - pLen),
      matchStart,
    );
    // Count matching characters from the end of both strings backwards
    const minLen = Math.min(before.length, pLen);
    for (let i = 1; i <= minLen; i++) {
      if (before[before.length - i] === selector.prefix[pLen - i]) {
        earned++;
      }
    }
  }

  if (selector.suffix) {
    const sLen = selector.suffix.length;
    total += sLen;
    const after = documentText.substring(
      matchEnd,
      Math.min(documentText.length, matchEnd + sLen),
    );
    const minLen = Math.min(after.length, sLen);
    for (let i = 0; i < minLen; i++) {
      if (after[i] === selector.suffix[i]) {
        earned++;
      }
    }
  }

  return total === 0 ? 1 : earned / total;
}

/**
 * Try fuzzy matching by normalising whitespace in both the document and the
 * selector's exact text.  Returns all matches found plus a confidence penalty.
 */
function fuzzyFind(
  exact: string,
  documentText: string,
): { start: number; end: number; exact: string }[] {
  const normDoc = normalizeWhitespace(documentText);
  const normExact = normalizeWhitespace(exact);
  if (normExact.length === 0) return [];

  const normIndices = findAllExactIndices(normDoc, normExact);
  if (normIndices.length === 0) return [];

  // Map normalised indices back to original positions.
  // Build a mapping: normPos → originalPos
  const normToOrig: number[] = [];
  let ni = 0;
  for (let oi = 0; oi < documentText.length; oi++) {
    // Skip extra whitespace characters that got collapsed
    if (
      ni < normDoc.length &&
      normDoc[ni] === documentText[oi]
    ) {
      normToOrig[ni] = oi;
      ni++;
    } else if (/\s/.test(documentText[oi])) {
      // This whitespace char was collapsed; skip it
    } else {
      normToOrig[ni] = oi;
      ni++;
    }
  }

  return normIndices.map((nIdx) => {
    const origStart = normToOrig[nIdx] ?? 0;
    const normEnd = nIdx + normExact.length - 1;
    const origEnd = (normToOrig[normEnd] ?? origStart) + 1;
    return {
      start: origStart,
      end: origEnd,
      exact: documentText.substring(origStart, origEnd),
    };
  });
}

// ── public API ───────────────────────────────────────────────────────

/**
 * Find the best match for a TextQuoteSelector in a document.
 */
export function findAnchor(
  selector: TextQuoteSelector,
  documentText: string,
): AnchorMatch | null {
  if (documentText.length === 0) return null;

  // 1. Exact occurrences
  const indices = findAllExactIndices(documentText, selector.exact);

  if (indices.length === 1) {
    const ctx = scoreContext(
      selector,
      documentText,
      indices[0],
      indices[0] + selector.exact.length,
    );
    // Unique exact → confidence 1.0 (context just confirms)
    return {
      start: indices[0],
      end: indices[0] + selector.exact.length,
      exact: selector.exact,
      confidence: selector.prefix || selector.suffix ? ctx : 1.0,
    };
  }

  if (indices.length > 1) {
    // Score each by context
    const scored = indices.map((idx) => ({
      idx,
      score: scoreContext(
        selector,
        documentText,
        idx,
        idx + selector.exact.length,
      ),
    }));
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    return {
      start: best.idx,
      end: best.idx + selector.exact.length,
      exact: selector.exact,
      confidence: best.score,
    };
  }

  // 3. Fuzzy: normalise whitespace
  const fuzzyMatches = fuzzyFind(selector.exact, documentText);
  if (fuzzyMatches.length > 0) {
    if (fuzzyMatches.length === 1) {
      const m = fuzzyMatches[0];
      const ctxScore = scoreContext(selector, documentText, m.start, m.end);
      return {
        start: m.start,
        end: m.end,
        exact: m.exact,
        confidence: 0.8 * ctxScore,
      };
    }
    // Multiple fuzzy → score by context
    const scored = fuzzyMatches.map((m) => ({
      ...m,
      score: scoreContext(selector, documentText, m.start, m.end),
    }));
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    return {
      start: best.start,
      end: best.end,
      exact: best.exact,
      confidence: 0.8 * best.score,
    };
  }

  return null;
}

/**
 * Create a TextQuoteSelector from a selection range in a document.
 */
export function createSelector(
  documentText: string,
  start: number,
  end: number,
  contextChars: number = 32,
): TextQuoteSelector {
  const exact = documentText.slice(start, end);

  // Raw context slices
  let prefix = documentText.slice(Math.max(0, start - contextChars), start);
  let suffix = documentText.slice(end, Math.min(documentText.length, end + contextChars));

  // Trim prefix to word boundary (drop leading partial word)
  if (prefix.length > 0 && prefix.length === contextChars) {
    const firstSpace = prefix.search(/\s/);
    if (firstSpace !== -1 && firstSpace < prefix.length - 1) {
      prefix = prefix.slice(firstSpace + 1);
    }
  }

  // Trim suffix to word boundary (drop trailing partial word)
  if (suffix.length > 0 && suffix.length === contextChars) {
    const lastSpace = suffix.lastIndexOf(' ');
    const lastNewline = suffix.lastIndexOf('\n');
    const lastBoundary = Math.max(lastSpace, lastNewline);
    if (lastBoundary !== -1 && lastBoundary > 0) {
      suffix = suffix.slice(0, lastBoundary);
    }
  }

  return { exact, prefix, suffix };
}

/**
 * Find all matches for a selector, scored by context alignment.
 */
export function findAllAnchors(
  selector: TextQuoteSelector,
  documentText: string,
): AnchorMatch[] {
  const indices = findAllExactIndices(documentText, selector.exact);
  if (indices.length === 0) return [];

  const matches: AnchorMatch[] = indices.map((idx) => ({
    start: idx,
    end: idx + selector.exact.length,
    exact: selector.exact,
    confidence: scoreContext(
      selector,
      documentText,
      idx,
      idx + selector.exact.length,
    ),
  }));

  // Sort by position (stable)
  matches.sort((a, b) => a.start - b.start);
  return matches;
}
