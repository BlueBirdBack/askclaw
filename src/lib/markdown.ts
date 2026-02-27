import { Marked } from 'marked';
import DOMPurify from 'dompurify';

const marked = new Marked({
  gfm: true,
  breaks: true,
});

export function renderMarkdown(text: string): string {
  return DOMPurify.sanitize(marked.parse(text) as string);
}

/** Sanitize an HTML snippet, allowing only safe inline tags (for search highlights etc.) */
export function sanitizeSnippet(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['mark', 'b', 'em', 'strong'] });
}
