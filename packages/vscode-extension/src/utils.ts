import * as vscode from 'vscode';

export function getRelativePath(filePath: string): string {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceFolder && filePath.startsWith(workspaceFolder)) {
    return filePath.slice(workspaceFolder.length + 1).replace(/\\/g, '/');
  }
  return filePath.replace(/\\/g, '/');
}
<<<<<<< HEAD
=======

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  dispose(): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): DebouncedFunction<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const debounced = ((...args: Parameters<T>) => {
    if (disposed) return;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  }) as DebouncedFunction<T>;

  debounced.dispose = () => {
    disposed = true;
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  return debounced;
}
>>>>>>> feature/comment-controller-thread-sync
