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
exports.isWorkspaceEnabled = isWorkspaceEnabled;
exports.enableWorkspace = enableWorkspace;
exports.disableWorkspace = disableWorkspace;
const vscode = __importStar(require("vscode"));
const logger_1 = require("./logger");
const SECTION = 'gitnotate';
const ENABLED_REPOS_KEY = 'enabledRepos';
function getWorkspacePath() {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}
function getConfig() {
    return vscode.workspace.getConfiguration(SECTION);
}
function isWorkspaceEnabled() {
    const workspacePath = getWorkspacePath();
    if (!workspacePath)
        return false;
    const enabledRepos = getConfig().get(ENABLED_REPOS_KEY, []);
    return enabledRepos.includes(workspacePath);
}
async function enableWorkspace() {
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
        (0, logger_1.debug)('Settings: no workspace folder — cannot enable');
        return;
    }
    const config = getConfig();
    const enabledRepos = config.get(ENABLED_REPOS_KEY, []);
    if (!enabledRepos.includes(workspacePath)) {
        await config.update(ENABLED_REPOS_KEY, [...enabledRepos, workspacePath], vscode.ConfigurationTarget.Global);
        (0, logger_1.debug)('Settings: enabled workspace', workspacePath);
    }
    else {
        (0, logger_1.debug)('Settings: workspace already enabled', workspacePath);
    }
}
async function disableWorkspace() {
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
        (0, logger_1.debug)('Settings: no workspace folder — cannot disable');
        return;
    }
    const config = getConfig();
    const enabledRepos = config.get(ENABLED_REPOS_KEY, []);
    await config.update(ENABLED_REPOS_KEY, enabledRepos.filter((r) => r !== workspacePath), vscode.ConfigurationTarget.Global);
    (0, logger_1.debug)('Settings: disabled workspace', workspacePath);
}
//# sourceMappingURL=settings.js.map