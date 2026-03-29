/**
 * Hide ^gn metadata tags inside rendered comment elements.
 *
 * If the element contains ONLY the metadata (possibly with whitespace),
 * the entire element is hidden. Otherwise the specific text node
 * containing the tag is wrapped in a hidden `<span>`.
 */

const GN_METADATA_RE = /\^gn:\d+:[LR]:\d+:\d+/;

export function hideGnMetadataInComment(commentEl: HTMLElement): void {
  // Don't hide metadata inside textareas — those are pending comments
  // that need the ^gn tag visible in the editable text.
  if (commentEl.closest('textarea') || commentEl.querySelector('textarea')) {
    return;
  }

  const text = commentEl.textContent ?? '';
  const cleaned = text.replace(GN_METADATA_RE, '').trim();

  if (!cleaned) {
    commentEl.style.display = 'none';
  } else {
    const walker = document.createTreeWalker(commentEl, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (node.textContent && GN_METADATA_RE.test(node.textContent)) {
        // Don't touch text nodes inside textareas or form inputs
        if (node.parentElement?.closest('textarea, input')) continue;
        const span = document.createElement('span');
        span.style.display = 'none';
        span.textContent = node.textContent;
        node.replaceWith(span);
        break;
      }
    }
  }
}
