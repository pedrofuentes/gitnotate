export type HighlightStyle = 'dashed' | 'underline' | 'background';

const VALID_STYLES: readonly string[] = ['dashed', 'underline', 'background'];
const STORAGE_KEY = 'gitnotate-highlight-style';
const DEFAULT_STYLE: HighlightStyle = 'dashed';

export function isValidStyle(value: unknown): value is HighlightStyle {
  return typeof value === 'string' && VALID_STYLES.includes(value);
}

export async function getHighlightStyle(): Promise<HighlightStyle> {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const style = result[STORAGE_KEY] as HighlightStyle | undefined;
    return style ?? DEFAULT_STYLE;
  } catch {
    return DEFAULT_STYLE;
  }
}

export async function setHighlightStyle(style: HighlightStyle): Promise<void> {
  if (!isValidStyle(style)) {
    throw new Error(`Invalid highlight style: ${String(style)}`);
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: style });
}

export function applyHighlightStyle(style: HighlightStyle): void {
  document.body.setAttribute('data-gn-style', style);
}
