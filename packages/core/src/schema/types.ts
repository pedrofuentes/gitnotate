export interface TextQuoteSelector {
  exact: string;
  prefix?: string;
  suffix?: string;
}

export interface Author {
  github: string;
  name?: string;
}

export interface Reply {
  id: string;
  author: Author;
  body: string;
  created: string;
  updated?: string;
}

export interface Annotation {
  id: string;
  target: TextQuoteSelector;
  author: Author;
  body: string;
  created: string;
  updated?: string;
  resolved: boolean;
  resolvedBy?: Author;
  resolvedAt?: string;
  replies: Reply[];
}

export interface SidecarFile {
  $schema: string;
  version: '1.0';
  file: string;
  annotations: Annotation[];
}
