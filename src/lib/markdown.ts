import { Marked } from 'marked';

const marked = new Marked({
  gfm: true,
  breaks: true,
});

export function renderMarkdown(text: string): string {
  return marked.parse(text) as string;
}
