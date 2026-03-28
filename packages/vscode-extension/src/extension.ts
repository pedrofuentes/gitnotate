import * as vscode from 'vscode';
import { enableWorkspace, disableWorkspace } from './settings';

export function activate(context: vscode.ExtensionContext) {
  console.log('Gitnotate extension activated');

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
}

export function deactivate() {}
