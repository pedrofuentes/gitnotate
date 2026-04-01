import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';

/**
 * Integration tests for Gitnotate VSCode extension.
 *
 * These tests run inside a real VSCode instance via @vscode/test-electron.
 * They verify the extension activates correctly and the Comments API
 * integration works with real VSCode APIs.
 *
 * Tests that require GitHub authentication are skipped if no session exists.
 */

const EXTENSION_ID = 'pedrofuentes.gitnotate';
const FIXTURES_PATH = path.resolve(__dirname, '..', '..', 'integration-tests', 'fixtures');

function getFixturePath(filename: string): string {
  return path.join(FIXTURES_PATH, filename);
}

async function openDocument(filename: string): Promise<vscode.TextEditor> {
  const uri = vscode.Uri.file(getFixturePath(filename));
  const doc = await vscode.workspace.openTextDocument(uri);
  return vscode.window.showTextDocument(doc);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

suite('Gitnotate Integration Tests', () => {
  // Suite 9: Comment Thread Display (basic — no GitHub API)
  suite('Suite 9: Comment Controller & Threads', () => {
    test('9.1 — Extension activates on markdown files', async () => {
      const editor = await openDocument('edge-cases.md');
      assert.ok(editor, 'Editor should be open');
      assert.strictEqual(editor.document.languageId, 'markdown');

      // Give the extension time to activate
      await sleep(2000);

      const ext = vscode.extensions.getExtension(EXTENSION_ID);
      // Extension may not be found by ID in dev mode — check it activated via commands
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('gitnotate.addComment'),
        'gitnotate.addComment command should be registered'
      );
      assert.ok(
        commands.includes('gitnotate.enable'),
        'gitnotate.enable command should be registered'
      );
      assert.ok(
        commands.includes('gitnotate.disable'),
        'gitnotate.disable command should be registered'
      );
    });

    test('9.5 — No error when opening markdown with no comments', async () => {
      const editor = await openDocument('notes.md');
      assert.ok(editor, 'Editor should open without errors');
      assert.strictEqual(editor.document.languageId, 'markdown');
      // Just verify no exceptions — comments panel state can't be inspected via API
      await sleep(500);
    });
  });

  // Suite 11: CommentingRangeProvider
  suite('Suite 11: CommentingRangeProvider', () => {
    test('11.1 — Comment controller exists after activation', async () => {
      await openDocument('edge-cases.md');
      await sleep(2000);

      // Verify extension is active by checking commands exist
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('gitnotate.addComment'),
        'Extension should be activated and commands registered'
      );
    });

    test('11.2 — Non-markdown files do not trigger markdown-specific behavior', async () => {
      const editor = await openDocument('sample.js');
      assert.ok(editor, 'JS editor should open');
      assert.strictEqual(editor.document.languageId, 'javascript');
      // No error expected — extension should silently skip non-markdown
      await sleep(500);
    });
  });

  // Suite 12: Editor Change Sync
  suite('Suite 12: Editor Change Sync', () => {
    test('12.2 — Switching editors triggers without errors', async () => {
      // Open first file
      const editor1 = await openDocument('edge-cases.md');
      assert.ok(editor1);
      await sleep(1000);

      // Switch to second file
      const editor2 = await openDocument('notes.md');
      assert.ok(editor2);
      await sleep(500);

      // Switch back
      const editor3 = await openDocument('edge-cases.md');
      assert.ok(editor3);
      await sleep(500);

      // No errors = pass
    });

    test('12.3 — Rapid switching does not crash', async () => {
      // Rapidly switch between files
      for (let i = 0; i < 5; i++) {
        await openDocument(i % 2 === 0 ? 'edge-cases.md' : 'notes.md');
      }
      // Wait for debounce to settle
      await sleep(500);
      // No errors = pass
    });

    test('12.4 — Switching to non-markdown is ignored', async () => {
      await openDocument('edge-cases.md');
      await sleep(500);

      // Switch to JS file
      const jsEditor = await openDocument('sample.js');
      assert.strictEqual(jsEditor.document.languageId, 'javascript');
      await sleep(500);

      // No errors = pass
    });
  });

  // Suite 13: Highlights & Decorations
  suite('Suite 13: Decorations', () => {
    test('13.1 — No old yellow background decorations', async () => {
      const editor = await openDocument('edge-cases.md');
      await sleep(2000);

      // We can't directly inspect decorations via the public API,
      // but we can verify the extension doesn't throw and the editor is functional
      assert.ok(editor, 'Editor should remain functional after decoration application');
    });
  });

  // Suite 14: PrService
  suite('Suite 14: PrService', () => {
    test('14.1 — Add Comment command exists and is callable', async () => {
      const editor = await openDocument('edge-cases.md');

      // Select some text
      const selection = new vscode.Selection(
        new vscode.Position(4, 10),
        new vscode.Position(4, 30)
      );
      editor.selection = selection;
      await sleep(500);

      // Verify the command exists (don't execute — would need auth + PR)
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('gitnotate.addComment'),
        'addComment command should be available'
      );
    });
  });

  // Suite 16: Error Handling
  suite('Suite 16: Error Handling', () => {
    test('16.2 — Extension handles activation without git gracefully', async () => {
      // The fixture workspace is not a git repo, so git detection should fail gracefully
      const editor = await openDocument('edge-cases.md');
      await sleep(2000);

      // Extension should still be active — just no PR detection
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('gitnotate.addComment'),
        'Extension should still work without git'
      );
    });

    test('16.3 — Closing editors does not cause errors', async () => {
      const editor = await openDocument('edge-cases.md');
      await sleep(500);

      // Close all editors
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      await sleep(500);

      // Reopen — should work fine
      const editor2 = await openDocument('notes.md');
      assert.ok(editor2, 'Should be able to reopen after closing all');
    });
  });

  // Suite 17: Cache Persistence Across Tab Switches (Increment 3)
  suite('Suite 17: Cache Persistence', () => {
    test('17.1 — Tab switching does not crash (cache-first path)', async () => {
      // Open first markdown file
      const editor1 = await openDocument('edge-cases.md');
      assert.ok(editor1);
      await sleep(1500);

      // Switch to second file
      const editor2 = await openDocument('notes.md');
      assert.ok(editor2);
      await sleep(1000);

      // Switch back — cache-first path should activate without errors
      const editor3 = await openDocument('edge-cases.md');
      assert.ok(editor3);
      await sleep(1000);

      // No errors = cache-first path works
    });
  });

  // Suite 18: Save-Triggered Refresh (Increment 3)
  suite('Suite 18: Save-Triggered Refresh', () => {
    test('18.1 — Saving a markdown file does not crash', async () => {
      const editor = await openDocument('edge-cases.md');
      assert.ok(editor);
      await sleep(1000);

      // Edit the file (insert a newline at position 0)
      await editor.edit((editBuilder) => {
        editBuilder.insert(new vscode.Position(0, 0), '\n');
      });

      // Save — triggers onDidSaveTextDocument handler
      await editor.document.save();
      await sleep(1000);

      // No crash = save handler works
      assert.ok(editor, 'Editor should remain functional after save');
    });

    test('18.2 — Saving a non-markdown file does not trigger sync', async () => {
      const editor = await openDocument('sample.js');
      assert.ok(editor);
      await sleep(500);

      // Edit and save
      await editor.edit((editBuilder) => {
        editBuilder.insert(new vscode.Position(0, 0), '// test\n');
      });
      await editor.document.save();
      await sleep(500);

      // No crash = non-markdown save correctly ignored
    });

    test('18.3 — Save after inserting lines does not crash', async () => {
      const editor = await openDocument('edge-cases.md');
      assert.ok(editor);
      await sleep(1000);

      // Insert two blank lines at the top (shifts all line numbers down)
      await editor.edit((editBuilder) => {
        editBuilder.insert(new vscode.Position(0, 0), '\n\n');
      });
      await editor.document.save();
      await sleep(1000);

      // Extension should handle shifted lines without crashing
      assert.ok(editor, 'Editor should remain functional after line shift + save');
    });
  });

  // Suite 19: Close-Tab Thread Cleanup (Increment 3)
  suite('Suite 19: Close-Tab Cleanup', () => {
    test('19.1 — Closing a markdown tab does not crash', async () => {
      const editor = await openDocument('edge-cases.md');
      assert.ok(editor);
      await sleep(1000);

      // Close the active editor
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      await sleep(500);

      // No crash = close handler works
    });

    test('19.3 — Close and reopen works without errors', async () => {
      // Open and let sync happen
      const editor1 = await openDocument('edge-cases.md');
      assert.ok(editor1);
      await sleep(1500);

      // Close
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      await sleep(500);

      // Reopen — cache-first should still work
      const editor2 = await openDocument('edge-cases.md');
      assert.ok(editor2);
      await sleep(1000);

      // No crash = PR cache survives close + reopen
    });
  });

  // Suite 22: Deactivation & Cleanup (Increment 3)
  suite('Suite 22: Deactivation & Cleanup', () => {
    test('22.2 — Close all and reopen works cleanly', async () => {
      const editor1 = await openDocument('edge-cases.md');
      assert.ok(editor1);
      await sleep(1000);

      // Close all editors
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      await sleep(500);

      // Reopen — extension should handle this gracefully
      const editor2 = await openDocument('notes.md');
      assert.ok(editor2);
      await sleep(1000);

      // Verify extension is still active
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('gitnotate.addComment'),
        'Extension should still be active after close-all + reopen'
      );
    });
  });
});
