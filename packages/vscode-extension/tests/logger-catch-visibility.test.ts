import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __reset } from '../__mocks__/vscode';
import { _resetForTesting } from '../src/logger';
import { CommentController } from '../src/comment-controller';
import { CommentThreadSync } from '../src/comment-thread-sync';
import { PrService } from '../src/pr-service';
import { CommentsTreeProvider } from '../src/comments-tree-provider';

describe('logger initialization catch visibility (#31)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    __reset();
    _resetForTesting(); // Ensure getLogger() will throw
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('CommentController warns when getLogger() throws', () => {
    const controller = new CommentController();

    expect(warnSpy).toHaveBeenCalledWith(
      'Gitnotate: logger initialization failed',
      expect.any(Error)
    );

    controller.dispose();
  });

  it('CommentThreadSync warns when getLogger() throws', () => {
    const mockPrService = {
      listReviewComments: vi.fn(),
    } as unknown as PrService;
    const mockController = {
      clearThreads: vi.fn(),
      createThread: vi.fn(),
    } as unknown as CommentController;

    new CommentThreadSync(mockPrService, mockController);

    expect(warnSpy).toHaveBeenCalledWith(
      'Gitnotate: logger initialization failed',
      expect.any(Error)
    );
  });

  it('PrService warns when getLogger() throws', () => {
    new PrService('fake-token');

    expect(warnSpy).toHaveBeenCalledWith(
      'Gitnotate: logger initialization failed',
      expect.any(Error)
    );
  });

  it('CommentsTreeProvider warns when getLogger() throws', () => {
    const provider = new CommentsTreeProvider();

    expect(warnSpy).toHaveBeenCalledWith(
      'Gitnotate: logger initialization failed',
      expect.any(Error)
    );

    provider.dispose();
  });
});
