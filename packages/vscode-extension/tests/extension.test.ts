import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock settings module
vi.mock('../src/settings', () => ({
  enableWorkspace: vi.fn(),
  disableWorkspace: vi.fn(),
}));

import { activate, deactivate } from '../src/extension';
import { commands } from '../__mocks__/vscode';

describe('extension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register all commands on activate', () => {
    const context = {
      subscriptions: [] as Array<{ dispose(): void }>,
    };

    // The registerCommand mock returns undefined, which gets pushed to subscriptions
    activate(context as any);

    expect(commands.registerCommand).toHaveBeenCalledWith(
      'gitnotate.enable',
      expect.any(Function)
    );
    expect(commands.registerCommand).toHaveBeenCalledWith(
      'gitnotate.disable',
      expect.any(Function)
    );
    expect(commands.registerCommand).toHaveBeenCalledWith(
      'gitnotate.addComment',
      expect.any(Function)
    );
    expect(commands.registerCommand).toHaveBeenCalledWith(
      'gitnotate.addFileComment',
      expect.any(Function)
    );
    expect(commands.registerCommand).toHaveBeenCalledTimes(4);
  });

  it('deactivate should be a no-op function', () => {
    expect(() => deactivate()).not.toThrow();
  });
});
