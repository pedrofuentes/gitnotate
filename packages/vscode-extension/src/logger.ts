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

// --- Output Channel Logger ---

function timestamp(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatArgs(args: unknown[]): string {
  return args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ');
}

export class Logger {
  constructor(private channel: vscode.OutputChannel) {}

  info(component: string, ...args: unknown[]): void {
    this.channel.appendLine(
      `[${timestamp()}] [INFO] [${component}] ${formatArgs(args)}`
    );
  }

  warn(component: string, ...args: unknown[]): void {
    this.channel.appendLine(
      `[${timestamp()}] [WARN] [${component}] ${formatArgs(args)}`
    );
  }

  error(component: string, ...args: unknown[]): void {
    this.channel.appendLine(
      `[${timestamp()}] [ERROR] [${component}] ${formatArgs(args)}`
    );
  }

  dispose(): void {
    this.channel.dispose();
  }
}

let singleton: Logger | undefined;

export function createLogger(): Logger {
  singleton?.dispose();
  const channel = vscode.window.createOutputChannel('Gitnotate');
  singleton = new Logger(channel);
  return singleton;
}

export function _resetForTesting(): void {
  singleton = undefined;
}

export function getLogger(): Logger {
  if (!singleton) {
    throw new Error('Logger not initialized — call createLogger() first');
  }
  return singleton;
}
