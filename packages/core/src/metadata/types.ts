export interface GnMetadata {
  exact: string;
  lineNumber: number;
  start: number;
  end: number;
}

export interface GnCommentBody {
  metadata: GnMetadata;
  userComment: string;
}
