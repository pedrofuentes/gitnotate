import * as vscode from 'vscode';
import { debug } from './logger';

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
      debug('GitService: vscode.git API loaded,', this.api.repositories.length, 'repo(s)');
    } else {
      debug('GitService: vscode.git extension not available');
    }
  }

  private getRepo(): GitRepository | undefined {
    return this.api?.repositories[0];
  }

  getCurrentBranch(): string | undefined {
    const branch = this.getRepo()?.state.HEAD?.name;
    debug('GitService.getCurrentBranch:', branch ?? '(none)');
    return branch;
  }

  getRemoteUrl(remoteName = 'origin'): string | undefined {
    const repo = this.getRepo();
    if (!repo) return undefined;
    const url = repo.state.remotes.find((r) => r.name === remoteName)?.fetchUrl;
    debug('GitService.getRemoteUrl:', remoteName, '→', url ?? '(not found)');
    return url;
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
      const result = { owner: match[1], repo: match[2] };
      debug('GitService.parseGitHubOwnerRepo:', remoteUrl, '→', `${result.owner}/${result.repo}`);
      return result;
    }
    debug('GitService.parseGitHubOwnerRepo:', remoteUrl, '→ not a GitHub URL');
    return null;
  }

  isDefaultBranch(): boolean {
    const branch = this.getCurrentBranch();
    if (!branch) return false;
    const isDefault = DEFAULT_BRANCHES.includes(branch);
    if (isDefault) {
      debug('GitService.isDefaultBranch:', branch, '— skipping PR detection');
    }
    return isDefault;
  }

  isAvailable(): boolean {
    const repo = this.getRepo();
    return repo !== undefined;
  }
}
