import * as fs from 'fs/promises';
import * as path from 'path';
import type { SidecarFile } from '@gitnotate/core';

export function getSidecarPath(filePath: string): string {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  return path.join(dir, '.comments', `${base}.json`);
}

export async function readLocalSidecar(
  filePath: string
): Promise<SidecarFile | null> {
  const sidecarPath = getSidecarPath(filePath);
  try {
    const content = await fs.readFile(sidecarPath, 'utf-8');
    return JSON.parse(content) as SidecarFile;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

export async function writeLocalSidecar(
  filePath: string,
  sidecar: SidecarFile
): Promise<void> {
  const sidecarPath = getSidecarPath(filePath);
  const dir = path.dirname(sidecarPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(sidecarPath, JSON.stringify(sidecar, null, 2), 'utf-8');
}
