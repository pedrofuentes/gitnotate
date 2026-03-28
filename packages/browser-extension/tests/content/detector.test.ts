import { describe, it, expect, beforeEach } from 'vitest';
import { detectGitHubPage, type GitHubPageInfo } from '../../src/content/detector';

function setLocation(url: string): void {
  Object.defineProperty(window, 'location', {
    value: new URL(url),
    writable: true,
    configurable: true,
  });
}

function addDiffElements(): void {
  const el = document.createElement('div');
  el.setAttribute('data-diff-anchor', 'true');
  document.body.appendChild(el);
}

describe('detectGitHubPage', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('PR Files Changed page', () => {
    it('should detect PR Files Changed page from URL with diff elements', () => {
      setLocation('https://github.com/pedrofuentes/gitnotate/pull/42/files');
      addDiffElements();

      const result = detectGitHubPage();

      expect(result.type).toBe('pr-files-changed');
      expect(result.owner).toBe('pedrofuentes');
      expect(result.repo).toBe('gitnotate');
      expect(result.prNumber).toBe(42);
    });

    it('should detect PR Files Changed even without diff DOM elements (URL is sufficient)', () => {
      setLocation('https://github.com/pedrofuentes/gitnotate/pull/42/files');

      const result = detectGitHubPage();

      expect(result.type).toBe('pr-files-changed');
      expect(result.prNumber).toBe(42);
    });

    it('should handle files URL with query strings', () => {
      setLocation(
        'https://github.com/owner/repo/pull/7/files?diff=unified&w=1'
      );

      const result = detectGitHubPage();

      expect(result.type).toBe('pr-files-changed');
      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('repo');
      expect(result.prNumber).toBe(7);
    });

    it('should handle files URL with hash fragments', () => {
      setLocation(
        'https://github.com/owner/repo/pull/99/files#diff-abc123'
      );

      const result = detectGitHubPage();

      expect(result.type).toBe('pr-files-changed');
      expect(result.prNumber).toBe(99);
    });
  });

  describe('PR Conversation page', () => {
    it('should detect PR Conversation page', () => {
      setLocation('https://github.com/pedrofuentes/gitnotate/pull/10');

      const result = detectGitHubPage();

      expect(result.type).toBe('pr-conversation');
      expect(result.owner).toBe('pedrofuentes');
      expect(result.repo).toBe('gitnotate');
      expect(result.prNumber).toBe(10);
    });

    it('should detect PR Conversation with trailing slash', () => {
      setLocation('https://github.com/owner/repo/pull/5/');

      const result = detectGitHubPage();

      expect(result.type).toBe('pr-conversation');
      expect(result.prNumber).toBe(5);
    });

    it('should detect PR commits tab as conversation (not files-changed)', () => {
      setLocation('https://github.com/owner/repo/pull/3/commits');

      const result = detectGitHubPage();

      expect(result.type).toBe('pr-conversation');
      expect(result.prNumber).toBe(3);
    });
  });

  describe('File View page', () => {
    it('should detect file view page', () => {
      setLocation(
        'https://github.com/pedrofuentes/gitnotate/blob/main/src/index.ts'
      );

      const result = detectGitHubPage();

      expect(result.type).toBe('file-view');
      expect(result.owner).toBe('pedrofuentes');
      expect(result.repo).toBe('gitnotate');
      expect(result.branch).toBe('main');
      expect(result.filePath).toBe('src/index.ts');
    });

    it('should handle deeply nested file paths', () => {
      setLocation(
        'https://github.com/owner/repo/blob/develop/packages/core/src/utils/helpers.ts'
      );

      const result = detectGitHubPage();

      expect(result.type).toBe('file-view');
      expect(result.branch).toBe('develop');
      expect(result.filePath).toBe('packages/core/src/utils/helpers.ts');
    });

    it('should handle branch names with slashes', () => {
      setLocation(
        'https://github.com/owner/repo/blob/feature/my-branch/README.md'
      );

      const result = detectGitHubPage();

      expect(result.type).toBe('file-view');
      // Branch extraction with slashes is ambiguous; the first segment is taken
      expect(result.branch).toBe('feature');
      expect(result.filePath).toBe('my-branch/README.md');
    });

    it('should handle file view with query strings', () => {
      setLocation(
        'https://github.com/owner/repo/blob/main/file.ts?plain=1#L10'
      );

      const result = detectGitHubPage();

      expect(result.type).toBe('file-view');
      expect(result.branch).toBe('main');
      expect(result.filePath).toBe('file.ts');
    });
  });

  describe('Other pages', () => {
    it('should return "other" for GitHub homepage', () => {
      setLocation('https://github.com');

      const result = detectGitHubPage();

      expect(result.type).toBe('other');
      expect(result.owner).toBe('');
      expect(result.repo).toBe('');
    });

    it('should return "other" for repository root', () => {
      setLocation('https://github.com/owner/repo');

      const result = detectGitHubPage();

      expect(result.type).toBe('other');
      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('repo');
    });

    it('should return "other" for issues page', () => {
      setLocation('https://github.com/owner/repo/issues/5');

      const result = detectGitHubPage();

      expect(result.type).toBe('other');
    });

    it('should return "other" for settings page', () => {
      setLocation('https://github.com/owner/repo/settings');

      const result = detectGitHubPage();

      expect(result.type).toBe('other');
    });

    it('should handle GitHub Enterprise URLs gracefully (return "other")', () => {
      setLocation('https://github.mycompany.com/owner/repo/pull/1/files');

      const result = detectGitHubPage();

      expect(result.type).toBe('other');
      expect(result.owner).toBe('');
      expect(result.repo).toBe('');
    });

    it('should return "other" for non-GitHub URLs', () => {
      setLocation('https://gitlab.com/owner/repo/pull/1/files');

      const result = detectGitHubPage();

      expect(result.type).toBe('other');
    });
  });

  describe('field extraction', () => {
    it('should extract owner and repo correctly', () => {
      setLocation('https://github.com/myorg/my-project/pull/123/files');

      const result = detectGitHubPage();

      expect(result.owner).toBe('myorg');
      expect(result.repo).toBe('my-project');
    });

    it('should extract PR number as a number, not a string', () => {
      setLocation('https://github.com/owner/repo/pull/456/files');

      const result = detectGitHubPage();

      expect(result.prNumber).toBe(456);
      expect(typeof result.prNumber).toBe('number');
    });

    it('should not set prNumber for non-PR pages', () => {
      setLocation('https://github.com/owner/repo/blob/main/file.ts');

      const result = detectGitHubPage();

      expect(result.prNumber).toBeUndefined();
    });

    it('should not set filePath or branch for PR pages', () => {
      setLocation('https://github.com/owner/repo/pull/1/files');

      const result = detectGitHubPage();

      expect(result.filePath).toBeUndefined();
      expect(result.branch).toBeUndefined();
    });
  });
});
