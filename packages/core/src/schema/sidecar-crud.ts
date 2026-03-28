import type { SidecarFile, Annotation, Reply, Author } from './types';

const SCHEMA_URL = 'https://gitnotate.dev/schemas/sidecar-v1.json';

function generateId(): string {
  // Simple random ID: 21-char base36 string
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 21; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function nowISO(): string {
  return new Date().toISOString();
}

export function createSidecarFile(filePath: string): SidecarFile {
  return {
    $schema: SCHEMA_URL,
    version: '1.0',
    file: filePath,
    annotations: [],
  };
}

export function addAnnotation(
  sidecar: SidecarFile,
  annotation: Omit<Annotation, 'id' | 'created' | 'replies' | 'resolved'>,
): SidecarFile {
  const newAnnotation: Annotation = {
    ...annotation,
    id: generateId(),
    created: nowISO(),
    resolved: false,
    replies: [],
  };
  return {
    ...sidecar,
    annotations: [...sidecar.annotations, newAnnotation],
  };
}

export function addReply(
  sidecar: SidecarFile,
  annotationId: string,
  reply: Omit<Reply, 'id' | 'created'>,
): SidecarFile {
  const index = sidecar.annotations.findIndex((a) => a.id === annotationId);
  if (index === -1) {
    throw new Error(`Annotation with ID "${annotationId}" not found`);
  }

  const newReply: Reply = {
    ...reply,
    id: generateId(),
    created: nowISO(),
  };

  const annotation = sidecar.annotations[index];
  const updatedAnnotation: Annotation = {
    ...annotation,
    replies: [...annotation.replies, newReply],
  };

  const updatedAnnotations = [...sidecar.annotations];
  updatedAnnotations[index] = updatedAnnotation;

  return { ...sidecar, annotations: updatedAnnotations };
}

export function resolveAnnotation(
  sidecar: SidecarFile,
  annotationId: string,
  resolvedBy: Author,
): SidecarFile {
  const index = sidecar.annotations.findIndex((a) => a.id === annotationId);
  if (index === -1) {
    throw new Error(`Annotation with ID "${annotationId}" not found`);
  }

  const updatedAnnotation: Annotation = {
    ...sidecar.annotations[index],
    resolved: true,
    resolvedBy,
    resolvedAt: nowISO(),
  };

  const updatedAnnotations = [...sidecar.annotations];
  updatedAnnotations[index] = updatedAnnotation;

  return { ...sidecar, annotations: updatedAnnotations };
}

export function reopenAnnotation(
  sidecar: SidecarFile,
  annotationId: string,
): SidecarFile {
  const index = sidecar.annotations.findIndex((a) => a.id === annotationId);
  if (index === -1) {
    throw new Error(`Annotation with ID "${annotationId}" not found`);
  }

  const { resolvedBy: _resolvedBy, resolvedAt: _resolvedAt, ...rest } = sidecar.annotations[index];
  const updatedAnnotation: Annotation = {
    ...rest,
    resolved: false,
  };

  const updatedAnnotations = [...sidecar.annotations];
  updatedAnnotations[index] = updatedAnnotation;

  return { ...sidecar, annotations: updatedAnnotations };
}

export function deleteAnnotation(
  sidecar: SidecarFile,
  annotationId: string,
): SidecarFile {
  const index = sidecar.annotations.findIndex((a) => a.id === annotationId);
  if (index === -1) {
    throw new Error(`Annotation with ID "${annotationId}" not found`);
  }

  return {
    ...sidecar,
    annotations: sidecar.annotations.filter((a) => a.id !== annotationId),
  };
}
