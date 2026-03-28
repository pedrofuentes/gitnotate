export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const ISO_8601_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isValidISO8601(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (!ISO_8601_RE.test(value)) return false;
  return !isNaN(Date.parse(value));
}

function validateAuthor(data: unknown, path: string, errors: string[]): void {
  if (!isObject(data)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (!isNonEmptyString(data.github)) {
    errors.push(`${path}.github must be a non-empty string`);
  }
  if (data.name !== undefined && typeof data.name !== 'string') {
    errors.push(`${path}.name must be a string if provided`);
  }
}

function validateReply(data: unknown, path: string, errors: string[]): void {
  if (!isObject(data)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (!isNonEmptyString(data.id)) {
    errors.push(`${path}.id must be a non-empty string`);
  }
  validateAuthor(data.author, `${path}.author`, errors);
  if (!isNonEmptyString(data.body)) {
    errors.push(`${path}.body must be a non-empty string`);
  }
  if (!isValidISO8601(data.created)) {
    errors.push(`${path}.created must be a valid ISO 8601 date`);
  }
  if (data.updated !== undefined && !isValidISO8601(data.updated)) {
    errors.push(`${path}.updated must be a valid ISO 8601 date`);
  }
}

function validateAnnotationFields(
  data: unknown,
  path: string,
  errors: string[],
): void {
  if (!isObject(data)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (!isNonEmptyString(data.id)) {
    errors.push(`${path}.id must be a non-empty string`);
  }

  // target
  if (!isObject(data.target)) {
    errors.push(`${path}.target must be an object`);
  } else {
    if (!isNonEmptyString(data.target.exact)) {
      errors.push(`${path}.target.exact must be a non-empty string`);
    }
    if (data.target.prefix !== undefined && typeof data.target.prefix !== 'string') {
      errors.push(`${path}.target.prefix must be a string if provided`);
    }
    if (data.target.suffix !== undefined && typeof data.target.suffix !== 'string') {
      errors.push(`${path}.target.suffix must be a string if provided`);
    }
  }

  validateAuthor(data.author, `${path}.author`, errors);

  if (!isNonEmptyString(data.body)) {
    errors.push(`${path}.body must be a non-empty string`);
  }
  if (!isValidISO8601(data.created)) {
    errors.push(`${path}.created must be a valid ISO 8601 date`);
  }
  if (data.updated !== undefined && !isValidISO8601(data.updated)) {
    errors.push(`${path}.updated must be a valid ISO 8601 date`);
  }
  if (typeof data.resolved !== 'boolean') {
    errors.push(`${path}.resolved must be a boolean`);
  }
  if (data.resolvedBy !== undefined) {
    validateAuthor(data.resolvedBy, `${path}.resolvedBy`, errors);
  }
  if (data.resolvedAt !== undefined && !isValidISO8601(data.resolvedAt)) {
    errors.push(`${path}.resolvedAt must be a valid ISO 8601 date`);
  }

  // replies
  if (!Array.isArray(data.replies)) {
    errors.push(`${path}.replies must be an array`);
  } else {
    data.replies.forEach((reply: unknown, i: number) => {
      validateReply(reply, `${path}.replies[${i}]`, errors);
    });
  }
}

/** Collect all annotation and reply IDs and check for duplicates. */
function checkUniqueIds(annotations: unknown[], errors: string[]): void {
  const seen = new Set<string>();
  for (const ann of annotations) {
    if (!isObject(ann)) continue;
    const annId = ann.id;
    if (typeof annId === 'string' && annId.length > 0) {
      if (seen.has(annId)) {
        errors.push(`duplicate ID "${annId}" — IDs must be unique within the file`);
      }
      seen.add(annId);
    }
    if (Array.isArray(ann.replies)) {
      for (const reply of ann.replies) {
        if (!isObject(reply)) continue;
        const replyId = reply.id;
        if (typeof replyId === 'string' && replyId.length > 0) {
          if (seen.has(replyId)) {
            errors.push(
              `duplicate ID "${replyId}" — IDs must be unique within the file`,
            );
          }
          seen.add(replyId);
        }
      }
    }
  }
}

export function validateSidecarFile(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(data)) {
    return { valid: false, errors: ['sidecar file must be an object'] };
  }

  if (data.version !== '1.0') {
    errors.push('version must be "1.0"');
  }
  if (!isNonEmptyString(data.file)) {
    errors.push('file must be a non-empty string');
  }

  if (!Array.isArray(data.annotations)) {
    errors.push('annotations must be an array');
  } else {
    data.annotations.forEach((ann: unknown, i: number) => {
      validateAnnotationFields(ann, `annotations[${i}]`, errors);
    });
    checkUniqueIds(data.annotations, errors);
  }

  return { valid: errors.length === 0, errors };
}

export function validateAnnotation(data: unknown): ValidationResult {
  const errors: string[] = [];
  validateAnnotationFields(data, 'annotation', errors);
  return { valid: errors.length === 0, errors };
}
