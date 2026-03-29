import * as core from '@actions/core';
import * as github from '@actions/github';
import { validateSidecarFile } from '@gitnotate/core';
import { validateAnchors, type AnchorValidationResult } from './anchor-validator.js';
import { buildSummaryComment } from './summary-reporter.js';

export async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token', { required: true });
    const octokit = github.getOctokit(token);
    const context = github.context;

    if (!context.payload.pull_request) {
      core.info('Not a pull request event, skipping');
      return;
    }

    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const pull_number = context.payload.pull_request.number;

    // 1. Find all changed files in this PR
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number,
    });

    // Filter for sidecar .comments/*.json files
    const sidecarFiles = files.filter(
      (f) => f.filename.includes('.comments/') && f.filename.endsWith('.json'),
    );

    if (sidecarFiles.length === 0) {
      core.info('No sidecar comment files changed in this PR');
      return;
    }

    const allResults: AnchorValidationResult[] = [];

    const processSidecar = async (sidecarFile: { filename: string }) => {
      // 2. Get the sidecar file content
      const { data: sidecarData } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: sidecarFile.filename,
        ref: context.payload.pull_request.head.sha,
      });

      if (!('content' in sidecarData)) {
        core.warning(`Could not read content of ${sidecarFile.filename}`);
        return [];
      }

      const sidecarContent = Buffer.from(sidecarData.content, 'base64').toString('utf-8');

      // Validate sidecar schema
      const validation = validateSidecarFile(JSON.parse(sidecarContent));
      if (!validation.valid) {
        core.warning(
          `Schema validation failed for ${sidecarFile.filename}: ${validation.errors.join(', ')}`,
        );
        return [];
      }

      // 3. Derive target file path from sidecar path
      const sidecarDir = sidecarFile.filename.substring(
        0,
        sidecarFile.filename.lastIndexOf('/'),
      );
      const targetFilePath = sidecarDir.replace(/\.comments$/, '');

      // Get target file content
      try {
        const { data: targetData } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: targetFilePath,
          ref: context.payload.pull_request.head.sha,
        });

        if (!('content' in targetData)) {
          core.warning(`Could not read content of target file ${targetFilePath}`);
          return [];
        }

        const fileContent = Buffer.from(targetData.content, 'base64').toString('utf-8');

        // 4. Validate anchors
        return await validateAnchors(sidecarFile.filename, sidecarContent, fileContent);
      } catch {
        core.warning(`Target file ${targetFilePath} not found`);
        return [];
      }
    };

    const settled = await Promise.allSettled(
      sidecarFiles.map((f) => processSidecar(f)),
    );

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value);
      } else {
        core.warning(`Failed to process sidecar file: ${result.reason}`);
      }
    }

    // 5. Post summary comment on the PR
    if (allResults.length > 0) {
      const comment = buildSummaryComment(allResults);
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pull_number,
        body: comment,
      });

      // Set action output
      const hasBroken = allResults.some((r) => r.status === 'broken');
      if (hasBroken) {
        core.setFailed('Some annotation anchors are broken');
      }
    }

    core.info(`Validated ${allResults.length} annotation(s) across ${sidecarFiles.length} file(s)`);
  } catch (error) {
    core.setFailed(`Action failed: ${error}`);
  }
}

export const runPromise = run();
