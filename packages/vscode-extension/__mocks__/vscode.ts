import { vi } from 'vitest';

let mockEnabledRepos: string[] = [];
let mockWorkspaceFolders: Array<{ uri: { fsPath: string } }> | undefined =
  undefined;
let mockGithubToken: string | undefined = undefined;
let mockActiveTextEditor: unknown = undefined;

export const ConfigurationTarget = {
  Global: 1,
  Workspace: 2,
  WorkspaceFolder: 3,
};

export const StatusBarAlignment = {
  Left: 1,
  Right: 2,
};

const mockConfig = {
  get: vi.fn((key: string, defaultValue?: unknown) => {
    if (key === 'enabledRepos') return [...mockEnabledRepos];
    if (key === 'githubToken') return mockGithubToken;
    return defaultValue;
  }),
  update: vi.fn(async (_key: string, value: unknown, _target?: unknown) => {
    mockEnabledRepos = value as string[];
  }),
};

export const workspace = {
  getConfiguration: vi.fn((_section?: string) => mockConfig),
  get workspaceFolders() {
    return mockWorkspaceFolders;
  },
};

export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number
  ) {}
}

export class Range {
  public readonly start: Position;
  public readonly end: Position;

  constructor(startLine: number, startChar: number, endLine: number, endChar: number);
  constructor(start: Position, end: Position);
  constructor(
    startOrPos: number | Position,
    startCharOrEnd: number | Position,
    endLine?: number,
    endChar?: number
  ) {
    if (typeof startOrPos === 'number') {
      this.start = new Position(startOrPos, startCharOrEnd as number);
      this.end = new Position(endLine!, endChar!);
    } else {
      this.start = startOrPos;
      this.end = startCharOrEnd as Position;
    }
  }

  get isEmpty(): boolean {
    return this.start.line === this.end.line && this.start.character === this.end.character;
  }
}

export class Uri {
  constructor(public readonly fsPath: string) {}
  static file(path: string): Uri {
    return new Uri(path);
  }
}

const mockStatusBarItem = {
  text: '',
  tooltip: '',
  show: vi.fn(),
  hide: vi.fn(),
  dispose: vi.fn(),
};

export const window = {
  showInformationMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  showInputBox: vi.fn(),
  createTextEditorDecorationType: vi.fn((options: Record<string, unknown>) => ({
    _options: options,
    dispose: vi.fn(),
  })),
  onDidChangeActiveTextEditor: vi.fn((_listener: unknown) => ({
    dispose: vi.fn(),
  })),
  createStatusBarItem: vi.fn(() => mockStatusBarItem),
  get activeTextEditor() {
    return mockActiveTextEditor;
  },
};

export const commands = {
  registerCommand: vi.fn(),
};

export const MarkdownString = vi.fn().mockImplementation((value?: string) => ({
  value: value ?? '',
  isTrusted: false,
  supportThemeIcons: false,
}));

// Test helpers — not part of the real vscode API
export function __setWorkspaceFolders(
  folders: Array<{ uri: { fsPath: string } }> | undefined
) {
  mockWorkspaceFolders = folders;
}

export function __setEnabledRepos(repos: string[]) {
  mockEnabledRepos = [...repos];
}

export function __getEnabledRepos(): string[] {
  return [...mockEnabledRepos];
}

export function __setGithubToken(token: string | undefined) {
  mockGithubToken = token;
}

export function __setActiveTextEditor(editor: unknown) {
  mockActiveTextEditor = editor;
}

export function __getStatusBarItem() {
  return mockStatusBarItem;
}

export function __reset() {
  mockEnabledRepos = [];
  mockWorkspaceFolders = undefined;
  mockGithubToken = undefined;
  mockActiveTextEditor = undefined;
  vi.clearAllMocks();
}
