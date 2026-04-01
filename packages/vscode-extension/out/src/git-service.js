"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitService = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("./logger");
const DEFAULT_BRANCHES = ['main', 'master'];
class GitService {
    api;
    constructor() {
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (gitExtension?.isActive) {
            this.api = gitExtension.exports.getAPI(1);
            (0, logger_1.debug)('GitService: vscode.git API loaded,', this.api.repositories.length, 'repo(s)');
        }
        else {
            (0, logger_1.debug)('GitService: vscode.git extension not available');
        }
    }
    getRepo() {
        return this.api?.repositories[0];
    }
    getCurrentBranch() {
        const branch = this.getRepo()?.state.HEAD?.name;
        (0, logger_1.debug)('GitService.getCurrentBranch:', branch ?? '(none)');
        return branch;
    }
    getRemoteUrl(remoteName = 'origin') {
        const repo = this.getRepo();
        if (!repo)
            return undefined;
        const url = repo.state.remotes.find((r) => r.name === remoteName)?.fetchUrl;
        (0, logger_1.debug)('GitService.getRemoteUrl:', remoteName, '→', url ?? '(not found)');
        return url;
    }
    getHeadCommit() {
        return this.getRepo()?.state.HEAD?.commit;
    }
    parseGitHubOwnerRepo(remoteUrl) {
        const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/);
        if (match) {
            const result = { owner: match[1], repo: match[2] };
            (0, logger_1.debug)('GitService.parseGitHubOwnerRepo:', remoteUrl, '→', `${result.owner}/${result.repo}`);
            return result;
        }
        (0, logger_1.debug)('GitService.parseGitHubOwnerRepo:', remoteUrl, '→ not a GitHub URL');
        return null;
    }
    isDefaultBranch() {
        const branch = this.getCurrentBranch();
        if (!branch)
            return false;
        const isDefault = DEFAULT_BRANCHES.includes(branch);
        if (isDefault) {
            (0, logger_1.debug)('GitService.isDefaultBranch:', branch, '— skipping PR detection');
        }
        return isDefault;
    }
    isAvailable() {
        const repo = this.getRepo();
        return repo !== undefined;
    }
}
exports.GitService = GitService;
//# sourceMappingURL=git-service.js.map