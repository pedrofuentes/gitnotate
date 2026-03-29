import { describe, it, expect, beforeEach } from 'vitest';
import {
  getMetadataEntries,
  addMetadataEntry,
  clearMetadataStore,
} from '../../src/content/metadata-store';

describe('metadata-store (WeakMap-based)', () => {
  let td: HTMLTableCellElement;

  beforeEach(() => {
    td = document.createElement('td');
    clearMetadataStore();
  });

  it('should return empty array for an element with no metadata', () => {
    expect(getMetadataEntries(td)).toEqual([]);
  });

  it('should add a metadata entry to an element', () => {
    addMetadataEntry(td, '10:5:15');
    expect(getMetadataEntries(td)).toEqual(['10:5:15']);
  });

  it('should support multiple entries on the same element', () => {
    addMetadataEntry(td, '10:5:15');
    addMetadataEntry(td, '10:20:30');
    expect(getMetadataEntries(td)).toEqual(['10:5:15', '10:20:30']);
  });

  it('should not add duplicate entries', () => {
    addMetadataEntry(td, '10:5:15');
    addMetadataEntry(td, '10:5:15');
    expect(getMetadataEntries(td)).toEqual(['10:5:15']);
  });

  it('should isolate metadata between different elements', () => {
    const td2 = document.createElement('td');
    addMetadataEntry(td, '1:0:5');
    addMetadataEntry(td2, '2:3:8');

    expect(getMetadataEntries(td)).toEqual(['1:0:5']);
    expect(getMetadataEntries(td2)).toEqual(['2:3:8']);
  });

  it('should clear all metadata on clearMetadataStore', () => {
    addMetadataEntry(td, '10:5:15');
    clearMetadataStore();
    expect(getMetadataEntries(td)).toEqual([]);
  });
});
