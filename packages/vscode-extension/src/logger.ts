import * as vscode from 'vscode';

const PREFIX = '[Gitnotate]';
let devMode: boolean | undefined;

function isDevMode(): boolean {
  if (devMode !== undefined) return devMode;
  return false;
}

export function initLogger(context: vscode.ExtensionContext): void {
  devMode = context.extensionMode === vscode.ExtensionMode.Development;
  if (devMode) {
    debug('Debug logging enabled (Extension Development Host)');
  }
}

export function debug(...args: unknown[]): void {
  if (isDevMode()) {
    console.log(PREFIX, ...args);
  }
}

export function warn(...args: unknown[]): void {
  console.warn(PREFIX, ...args);
}

export function error(...args: unknown[]): void {
  console.error(PREFIX, ...args);
}
