/**
 * WeakMap-based metadata storage for highlight entries on <td> elements.
 *
 * Replaces the previous approach of serializing metadata to/from
 * `data-gn-metadata` DOM attributes via JSON.parse/JSON.stringify,
 * avoiding serialization overhead on every highlight operation.
 *
 * Using WeakMap means entries are automatically garbage-collected
 * when the DOM element is removed.
 */

let store = new WeakMap<HTMLElement, string[]>();

export function getMetadataEntries(el: HTMLElement): string[] {
  return store.get(el) ?? [];
}

export function addMetadataEntry(el: HTMLElement, entry: string): void {
  const entries = store.get(el) ?? [];
  if (!entries.includes(entry)) {
    entries.push(entry);
    store.set(el, entries);
  }
}

export function clearMetadataStore(): void {
  store = new WeakMap<HTMLElement, string[]>();
}
