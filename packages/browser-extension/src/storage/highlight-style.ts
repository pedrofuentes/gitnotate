export type HighlightStyle = 'underline-dot' | 'underline' | 'background' | 'dashed';

const STORAGE_KEY = 'gitnotate-highlight-style';
const DEFAULT_STYLE: HighlightStyle = 'underline-dot';

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
  await chrome.storage.local.set({ [STORAGE_KEY]: style });
}

export function applyHighlightStyle(style: HighlightStyle): void {
  document.body.setAttribute('data-gn-style', style);
}
