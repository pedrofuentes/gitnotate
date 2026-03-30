import * as vscode from 'vscode';

interface GitRepository {
  state: {
    HEAD?: { name?: string; commit?: string };
    remotes: Array<{ name: string; fetchUrl: string }>;
  };
}

interface GitApi {
  repositories: GitRepository[];
}

interface GitExtensionExports {
  getAPI(version: number): GitApi;
}

const DEFAULT_BRANCHES = ['main', 'master'];

export class GitService {
  private readonly api: GitApi | undefined;

  constructor() {
    const gitExtension =
      vscode.extensions.getExtension<GitExtensionExports>('vscode.git');
    if (gitExtension?.isActive) {
      this.api = gitExtension.exports.getAPI(1);
    }
  }

  private getRepo(): GitRepository | undefined {
    return this.api?.repositories[0];
  }

  getCurrentBranch(): string | undefined {
    return this.getRepo()?.state.HEAD?.name;
  }

  getRemoteUrl(remoteName = 'origin'): string | undefined {
    const repo = this.getRepo();
    if (!repo) return undefined;
    return repo.state.remotes.find((r) => r.name === remoteName)?.fetchUrl;
  }

  getHeadCommit(): string | undefined {
    return this.getRepo()?.state.HEAD?.commit;
  }

  parseGitHubOwnerRepo(
    remoteUrl: string
  ): { owner: string; repo: string } | null {
    const match = remoteUrl.match(
      /github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/
    );
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
    return null;
  }

  isDefaultBranch(): boolean {
    const branch = this.getCurrentBranch();
    if (!branch) return false;
    return DEFAULT_BRANCHES.includes(branch);
  }

  isAvailable(): boolean {
    const repo = this.getRepo();
    return repo !== undefined;
  }
}
