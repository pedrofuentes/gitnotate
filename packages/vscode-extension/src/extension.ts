import * as vscode from 'vscode';
import { enableWorkspace, disableWorkspace } from './settings';
import { DecorationManager } from './decoration-manager';

let decorationManager: DecorationManager | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Gitnotate extension activated');

  decorationManager = new DecorationManager(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('gitnotate.enable', async () => {
      await enableWorkspace();
      vscode.window.showInformationMessage('Gitnotate enabled for this workspace');
    }),
    vscode.commands.registerCommand('gitnotate.disable', async () => {
      await disableWorkspace();
      vscode.window.showInformationMessage('Gitnotate disabled for this workspace');
    }),
    vscode.commands.registerCommand('gitnotate.addComment', () => {
      vscode.window.showInformationMessage('Add comment - not yet implemented');
    })
  );

  // Listen for active editor changes to apply @gn decorations in diff views
  const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(
    (_editor) => {
      // Placeholder: actual PR comment fetching comes in vscode-pr-integration
      // When implemented, this will check for @gn-decorated comments and
      // call decorationManager.applyDecorations(editor, decorations)
    }
  );

  context.subscriptions.push(editorChangeDisposable);
}

export function deactivate() {
  if (decorationManager) {
    decorationManager.dispose();
    decorationManager = undefined;
  }
}
