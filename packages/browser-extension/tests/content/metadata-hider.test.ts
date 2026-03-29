import { describe, it, expect, beforeEach } from 'vitest';
import { hideGnMetadataInComment } from '../../src/content/metadata-hider';

describe('hideGnMetadataInComment', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should hide the entire element when only ^gn metadata is present', () => {
    const el = document.createElement('p');
    el.textContent = '^gn:10:R:5:15';
    document.body.appendChild(el);

    hideGnMetadataInComment(el);

    expect(el.style.display).toBe('none');
  });

  it('should wrap metadata text node in a hidden span when mixed with other content', () => {
    const el = document.createElement('div');
    const textNode1 = document.createTextNode('Review this ');
    const textNode2 = document.createTextNode('^gn:3:L:0:5');
    el.appendChild(textNode1);
    el.appendChild(textNode2);
    document.body.appendChild(el);

    hideGnMetadataInComment(el);

    const hiddenSpan = el.querySelector('span[style*="display: none"]');
    expect(hiddenSpan).not.toBeNull();
    expect(hiddenSpan!.textContent).toBe('^gn:3:L:0:5');
  });

  it('should not modify elements inside a textarea', () => {
    const textarea = document.createElement('textarea');
    const el = document.createElement('p');
    el.textContent = '^gn:1:R:0:5';
    textarea.appendChild(el);
    document.body.appendChild(textarea);

    hideGnMetadataInComment(el);

    // Should not be hidden — textarea content must remain visible
    expect(el.style.display).not.toBe('none');
  });

  it('should not modify elements that contain a textarea', () => {
    const el = document.createElement('div');
    el.textContent = '^gn:1:R:0:5';
    const textarea = document.createElement('textarea');
    el.appendChild(textarea);
    document.body.appendChild(el);

    hideGnMetadataInComment(el);

    expect(el.style.display).not.toBe('none');
  });

  it('should not touch text nodes inside form inputs', () => {
    const el = document.createElement('div');
    const input = document.createElement('input');
    input.value = '^gn:1:R:0:5';
    el.appendChild(input);
    // Also add the text as a text node inside a nested input wrapper
    const wrapper = document.createElement('span');
    const inputInner = document.createElement('input');
    wrapper.appendChild(inputInner);
    el.appendChild(wrapper);
    el.appendChild(document.createTextNode('Some visible text'));
    document.body.appendChild(el);

    hideGnMetadataInComment(el);

    // No hidden span should be created since there's no ^gn text node
    const hiddenSpan = el.querySelector('span[style*="display: none"]');
    expect(hiddenSpan).toBeNull();
  });

  it('should handle content with only whitespace around metadata', () => {
    const el = document.createElement('p');
    el.textContent = '  ^gn:5:R:2:8  ';
    document.body.appendChild(el);

    hideGnMetadataInComment(el);

    // After removing the ^gn tag, only whitespace remains — hide entirely
    expect(el.style.display).toBe('none');
  });

  it('should handle metadata in the middle of a text node', () => {
    const el = document.createElement('p');
    el.textContent = 'Fix this ^gn:7:R:3:9 please';
    document.body.appendChild(el);

    hideGnMetadataInComment(el);

    // The text node containing ^gn should be wrapped
    const hiddenSpan = el.querySelector('span[style*="display: none"]');
    expect(hiddenSpan).not.toBeNull();
  });
});
