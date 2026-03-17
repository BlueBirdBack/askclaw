import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/common'
import { Marked, type Tokens } from 'marked'

const marked = new Marked({
  breaks: true,
  gfm: true,
})

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

marked.use({
  renderer: {
    code(token: Tokens.Code): string {
      const language = token.lang?.trim().split(/\s+/)[0] ?? ''
      const highlighted =
        language && hljs.getLanguage(language)
          ? hljs.highlight(token.text, { language }).value
          : hljs.highlightAuto(token.text).value
      const label = language || 'text'

      return [
        '<pre>',
        `<span class="code-lang">${escapeAttribute(label)}</span>`,
        '<button class="code-copy-btn" type="button">Copy</button>',
        `<code class="hljs language-${escapeAttribute(label)}">${highlighted}</code>`,
        '</pre>',
      ].join('')
    },
  },
})

export function renderMarkdown(markdown: string): string {
  const rendered = marked.parse(markdown, { async: false })

  return DOMPurify.sanitize(rendered, {
    ALLOW_DATA_ATTR: true,
  })
}
