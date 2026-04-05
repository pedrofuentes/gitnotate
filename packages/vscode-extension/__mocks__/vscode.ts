import { vi } from 'vitest';

let mockEnabledRepos: string[] = [];
let mockWorkspaceFolders: Array<{ uri: { fsPath: string } }> | undefined =
  undefined;
let mockGithubToken: string | undefined = undefined;
let mockActiveTextEditor: unknown = undefined;
let mockAuthSession: { accessToken: string; id: string; scopes: string[] } | undefined = undefined;
let mockGitRepository: unknown = undefined;

// Comments API tracking
interface MockCommentThread {
  uri: unknown;
  range: unknown;
  comments: unknown[];
  label: string;
  canReply: boolean;
  contextValue: string;
  collapsibleState: number;
  state?: number;
  dispose: ReturnType<typeof vi.fn>;
}

interface MockCommentController {
  id: string;
  label: string;
  dispose: ReturnType<typeof vi.fn>;
  commentingRangeProvider: unknown;
  createCommentThread: ReturnType<typeof vi.fn>;
  threads: MockCommentThread[];
}

let mockCommentControllers: MockCommentController[] = [];

// TreeView tracking
interface MockTreeView {
  viewId: string;
  treeDataProvider: unknown;
  options: Record<string, unknown>;
  reveal: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  onDidChangeVisibility: ReturnType<typeof vi.fn>;
}

let mockTreeViews: MockTreeView[] = [];

// Context key tracking
const mockContextKeys: Map<string, unknown> = new Map();

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
  openTextDocument: vi.fn().mockResolvedValue({ uri: { fsPath: '/mock' } }),
  onDidSaveTextDocument: vi.fn((_listener: unknown) => ({
    dispose: vi.fn(),
  })),
  onDidCloseTextDocument: vi.fn((_listener: unknown) => ({
    dispose: vi.fn(),
  })),
  onDidChangeTextDocument: vi.fn((_listener: unknown) => ({
    dispose: vi.fn(),
  })),
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
  public readonly scheme: string;

  constructor(public readonly fsPath: string, scheme?: string) {
    this.scheme = scheme ?? 'file';
  }
  static file(path: string): Uri {
    return new Uri(path, 'file');
  }
  static parse(value: string): Uri {
    // Extract scheme from URI string (e.g., "git:/path" → scheme "git")
    const colonIndex = value.indexOf(':');
    const scheme = colonIndex > 0 ? value.slice(0, colonIndex) : 'file';
    return new Uri(value, scheme);
  }
  static from(components: { scheme: string; path: string }): Uri {
    return new Uri(components.path, components.scheme);
  }
  toString(): string {
    return `file://${this.fsPath}`;
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
  showTextDocument: vi.fn().mockResolvedValue(undefined),
  createTextEditorDecorationType: vi.fn((options: Record<string, unknown>) => ({
    _options: options,
    dispose: vi.fn(),
  })),
  onDidChangeActiveTextEditor: vi.fn((_listener: unknown) => ({
    dispose: vi.fn(),
  })),
  createOutputChannel: vi.fn((_name: string) => ({
    appendLine: vi.fn(),
    append: vi.fn(),
    clear: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  })),
  onDidChangeWindowState: vi.fn((_listener: unknown) => ({
    dispose: vi.fn(),
  })),
  createStatusBarItem: vi.fn(() => mockStatusBarItem),
  createTreeView: vi.fn((viewId: string, options: Record<string, unknown>) => {
    const treeDataProvider = options.treeDataProvider as Record<string, unknown> | undefined;
    const treeView: MockTreeView = {
      viewId,
      treeDataProvider: treeDataProvider,
      options,
      reveal: vi.fn().mockImplementation((_item: unknown, _options?: unknown) => {
        // Enforce VSCode contract: reveal() requires getParent() on the provider
        if (typeof treeDataProvider?.getParent !== 'function') {
          throw new Error(
            "Required registered TreeDataProvider to implement 'getParent' method to access 'reveal' method"
          );
        }
        return Promise.resolve();
      }),
      dispose: vi.fn(),
      onDidChangeVisibility: vi.fn((_listener: unknown) => ({ dispose: vi.fn() })),
    };
    mockTreeViews.push(treeView);
    return treeView;
  }),
  get activeTextEditor() {
    return mockActiveTextEditor;
  },
  get visibleTextEditors() {
    // In tests, return only the active editor (single-file view).
    // Tests that simulate diff views should override this.
    return mockActiveTextEditor ? [mockActiveTextEditor] : [];
  },
};

export const commands = {
  registerCommand: vi.fn(),
  executeCommand: vi.fn(async (command: string, ...args: unknown[]) => {
    if (command === 'setContext' && args.length >= 2) {
      mockContextKeys.set(args[0] as string, args[1]);
    }
  }),
};

export const authentication = {
  getSession: vi.fn(async (_providerId: string, _scopes: string[], _options?: unknown) => {
    return mockAuthSession;
  }),
  onDidChangeSessions: vi.fn((_listener: unknown) => ({
    dispose: vi.fn(),
  })),
};

export const extensions = {
  getExtension: vi.fn((_extensionId: string) => {
    if (_extensionId === 'vscode.git' && mockGitRepository !== undefined) {
      return {
        isActive: true,
        exports: {
          getAPI: () => ({
            repositories: [mockGitRepository],
          }),
        },
      };
    }
    return undefined;
  }),
};

export enum CommentThreadCollapsibleState {
  Collapsed = 0,
  Expanded = 1,
}

export enum CommentThreadState {
  Unresolved = 0,
  Resolved = 1,
}

export enum CommentMode {
  Preview = 0,
  Editing = 1,
}

export enum ExtensionMode {
  Production = 1,
  Development = 2,
  Test = 3,
}

export enum OverviewRulerLane {
  Left = 1,
  Center = 2,
  Right = 4,
  Full = 7,
}

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class TreeItem {
  label: string | { label: string };
  collapsibleState?: TreeItemCollapsibleState;
  description?: string;
  tooltip?: string;
  iconPath?: unknown;
  command?: { command: string; title: string; arguments?: unknown[] };
  contextValue?: string;

  constructor(label: string | { label: string }, collapsibleState?: TreeItemCollapsibleState) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export class ThemeIcon {
  constructor(
    public readonly id: string,
    public readonly color?: unknown
  ) {}
}

export class EventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];

  event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => { this.listeners = this.listeners.filter(l => l !== listener); } };
  };

  fire(data: T): void {
    for (const listener of this.listeners) {
      listener(data);
    }
  }

  dispose(): void {
    this.listeners = [];
  }
}

export const comments = {
  createCommentController: vi.fn((id: string, label: string) => {
    const controller: MockCommentController = {
      id,
      label,
      dispose: vi.fn(),
      commentingRangeProvider: undefined as unknown,
      threads: [],
      createCommentThread: vi.fn((uri: unknown, range: unknown, commentsArr: unknown[]) => {
        const thread: MockCommentThread = {
          uri,
          range,
          comments: commentsArr,
          label: '',
          canReply: true,
          contextValue: '',
          collapsibleState: 0,
          dispose: vi.fn(),
        };
        controller.threads.push(thread);
        return thread;
      }),
    };
    mockCommentControllers.push(controller);
    return controller;
  }),
};

export const MarkdownString = vi.fn().mockImplementation((value?: string) => {
  const md = {
    value: value ?? '',
    isTrusted: false,
    supportHtml: false,
    supportThemeIcons: false,
    appendMarkdown(val: string) {
      md.value += val;
      return md;
    },
    appendText(val: string) {
      md.value += val;
      return md;
    },
  };
  return md;
});

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

export function __setAuthSession(session: { accessToken: string; id: string; scopes: string[] } | undefined) {
  mockAuthSession = session;
  authentication.getSession.mockImplementation(async () => session);
}

export function __clearAuth() {
  mockAuthSession = undefined;
  authentication.getSession.mockImplementation(async () => undefined);
}

export function __setGitRepository(repo: unknown) {
  mockGitRepository = repo;
  extensions.getExtension.mockImplementation((_extensionId: string) => {
    if (_extensionId === 'vscode.git' && repo !== undefined) {
      return {
        isActive: true,
        exports: {
          getAPI: () => ({
            repositories: [repo],
          }),
        },
      };
    }
    return undefined;
  });
}

export function __getCommentControllers(): MockCommentController[] {
  return mockCommentControllers;
}

export function __getCommentThreads(): MockCommentThread[] {
  return mockCommentControllers.flatMap((c) => c.threads);
}

export function __getTreeViews(): MockTreeView[] {
  return mockTreeViews;
}

export function __getContextKeys(): Map<string, unknown> {
  return new Map(mockContextKeys);
}

export function __reset() {
  mockEnabledRepos = [];
  mockWorkspaceFolders = undefined;
  mockGithubToken = undefined;
  mockActiveTextEditor = undefined;
  mockAuthSession = undefined;
  mockGitRepository = undefined;
  mockCommentControllers = [];
  mockTreeViews = [];
  mockContextKeys.clear();
  mockStatusBarItem.text = '';
  mockStatusBarItem.tooltip = '';
  delete (mockStatusBarItem as Record<string, unknown>).command;
  vi.clearAllMocks();
  authentication.getSession.mockImplementation(async () => undefined);
  authentication.onDidChangeSessions.mockImplementation((_listener: unknown) => ({
    dispose: vi.fn(),
  }));
  extensions.getExtension.mockImplementation(() => undefined);
}
