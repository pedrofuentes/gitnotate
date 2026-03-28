export type {
  TextQuoteSelector,
  Author,
  Reply,
  Annotation,
  SidecarFile,
} from './types';

export type { ValidationResult } from './validation';
export { validateSidecarFile, validateAnnotation } from './validation';

export {
  createSidecarFile,
  addAnnotation,
  addReply,
  resolveAnnotation,
  reopenAnnotation,
  deleteAnnotation,
} from './sidecar-crud';
