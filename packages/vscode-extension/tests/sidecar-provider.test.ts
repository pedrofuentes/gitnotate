import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path');
  return { ...actual, default: actual };
});

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  getSidecarPath,
  readLocalSidecar,
  writeLocalSidecar,
} from '../src/sidecar-provider';
import type { SidecarFile } from '@gitnotate/core';

const mockReadFile = vi.mocked(fs.readFile);
const mockWriteFile = vi.mocked(fs.writeFile);
const mockMkdir = vi.mocked(fs.mkdir);

describe('sidecar-provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSidecarPath', () => {
    it('should compute correct sidecar path', () => {
      const result = getSidecarPath(path.join('path', 'to', 'doc.md'));
      const expected = path.join('path', 'to', '.comments', 'doc.md.json');
      expect(result).toBe(expected);
    });
  });

  describe('readLocalSidecar', () => {
    it('should read existing sidecar file', async () => {
      const sidecar: SidecarFile = {
        $schema: 'https://gitnotate.dev/schema/v1',
        version: '1.0',
        file: 'doc.md',
        annotations: [],
      };
      mockReadFile.mockResolvedValue(JSON.stringify(sidecar));

      const result = await readLocalSidecar(path.join('path', 'to', 'doc.md'));

      expect(mockReadFile).toHaveBeenCalledWith(
        path.join('path', 'to', '.comments', 'doc.md.json'),
        'utf-8'
      );
      expect(result).toEqual(sidecar);
    });

    it('should return null for missing file', async () => {
      const err = new Error('ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      mockReadFile.mockRejectedValue(err);

      const result = await readLocalSidecar(path.join('path', 'to', 'doc.md'));

      expect(result).toBeNull();
    });
  });

  describe('writeLocalSidecar', () => {
    it('should write sidecar file', async () => {
      const sidecar: SidecarFile = {
        $schema: 'https://gitnotate.dev/schema/v1',
        version: '1.0',
        file: 'doc.md',
        annotations: [],
      };
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue();

      await writeLocalSidecar(path.join('path', 'to', 'doc.md'), sidecar);

      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join('path', 'to', '.comments', 'doc.md.json'),
        JSON.stringify(sidecar, null, 2),
        'utf-8'
      );
    });

    it('should create .comments directory if needed', async () => {
      const sidecar: SidecarFile = {
        $schema: 'https://gitnotate.dev/schema/v1',
        version: '1.0',
        file: 'doc.md',
        annotations: [],
      };
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue();

      await writeLocalSidecar(path.join('path', 'to', 'doc.md'), sidecar);

      expect(mockMkdir).toHaveBeenCalledWith(
        path.join('path', 'to', '.comments'),
        { recursive: true }
      );
    });
  });
});
