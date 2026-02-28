import { Marked } from 'marked';
import DOMPurify from 'dompurify';

const marked = new Marked({
  gfm: true,
  breaks: true,
});

// CJK Unicode ranges: CJK Unified Ideographs, Hiragana, Katakana, CJK punctuation, fullwidth forms
const CJK = '\\u2E80-\\u9FFF\\uF900-\\uFAFF\\uFE30-\\uFE4F\\uFF00-\\uFFEF';
/** Insert spaces between **bold** markers and adjacent CJK so marked can parse bold */
function fixBoldCJK(text: string): string {
  // Track whether we're looking at opening or closing ** by counting occurrences
  // Simple approach: match complete **...** spans and pad with spaces
  return text.replace(
    new RegExp(`([${CJK}])\\*\\*(.+?)\\*\\*([${CJK}])`, 'g'),
    '$1 **$2** $3',
  ).replace(
    new RegExp(`([${CJK}])\\*\\*(.+?)\\*\\*`, 'g'),
    '$1 **$2**',
  ).replace(
    new RegExp(`\\*\\*(.+?)\\*\\*([${CJK}])`, 'g'),
    '**$1** $2',
  );
}

export function renderMarkdown(text: string): string {
  return DOMPurify.sanitize(marked.parse(fixBoldCJK(text)) as string);
}

/** Sanitize an HTML snippet, allowing only safe inline tags (for search highlights etc.) */
export function sanitizeSnippet(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['mark', 'b', 'em', 'strong'] });
}
