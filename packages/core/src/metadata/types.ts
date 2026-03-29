export interface GnMetadata {
  exact: string;
  lineNumber: number;
  side: 'L' | 'R';
  start: number;
  end: number;
}

export interface GnCommentBody {
  metadata: GnMetadata;
  userComment: string;
}
