import type { DisplayMessage } from './types';

export function exportChatAsMarkdown(messages: DisplayMessage[]): void {
  const parts: string[] = [];

  for (const msg of messages) {
    if (msg.role === 'error') continue;
    const heading = msg.role === 'user' ? '## User' : '## Assistant';
    let body = msg.content;

    if (msg.attachments && msg.attachments.length > 0) {
      const imageRefs = msg.attachments
        .map((att) => `![${att.filename}](${att.url})`)
        .join('\n');
      body = body ? `${imageRefs}\n\n${body}` : imageRefs;
    }

    parts.push(`${heading}\n\n${body}`);
  }

  const text = parts.join('\n\n');
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `askclaw-chat-${date}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
