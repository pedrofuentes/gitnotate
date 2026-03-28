export interface GnMetadata {
  exact: string;
  start: number;
  end: number;
}

export interface GnCommentBody {
  metadata: GnMetadata;
  userComment: string;
}
