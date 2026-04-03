import * as vscode from 'vscode';

export class StatusBarManager {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.command = 'gitnotate.refreshComments';
  }

  show(prNumber: number): void {
    this.item.text = '$(git-pull-request) Gitnotate: PR #' + prNumber;
    this.item.tooltip = 'Click to refresh Gitnotate comments';
    this.item.show();
  }

  hide(): void {
    this.item.hide();
  }

  setLoading(): void {
    this.item.text = '$(sync~spin) Gitnotate: Loading...';
    this.item.show();
  }

  setError(message: string): void {
    this.item.text = '$(error) Gitnotate: Error';
    this.item.tooltip = message;
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}
