import { vi } from 'vitest';

let mockEnabledRepos: string[] = [];
let mockWorkspaceFolders: Array<{ uri: { fsPath: string } }> | undefined =
  undefined;

export const ConfigurationTarget = {
  Global: 1,
  Workspace: 2,
  WorkspaceFolder: 3,
};

const mockConfig = {
  get: vi.fn((key: string, defaultValue?: unknown) => {
    if (key === 'enabledRepos') return [...mockEnabledRepos];
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

export const window = {
  showInformationMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  showWarningMessage: vi.fn(),
};

export const commands = {
  registerCommand: vi.fn(),
};

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

export function __reset() {
  mockEnabledRepos = [];
  mockWorkspaceFolders = undefined;
  vi.clearAllMocks();
}
