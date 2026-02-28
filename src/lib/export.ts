import type { DisplayMessage } from './types';
import { renderMarkdown } from './markdown';

export function exportChatAsMarkdown(messages: DisplayMessage[]): void {
  const parts: string[] = [];

  for (const msg of messages) {
    if (msg.role === 'error') continue;
    const heading = msg.role === 'user' ? '## User' : '## Assistant';
    let body = msg.content;

    if (msg.attachments && msg.attachments.length > 0) {
      const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
      const refs = msg.attachments
        .map((att) => IMAGE_TYPES.has(att.content_type)
          ? `![${att.filename}](${att.url})`
          : `[${att.filename}](${att.url})`)
        .join('\n');
      body = body ? `${refs}\n\n${body}` : refs;
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

export async function exportChatAsPdf(messages: DisplayMessage[]): Promise<void> {
  const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

  const container = document.createElement('div');
  container.style.cssText = 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; padding: 20px; max-width: 700px;';

  const title = document.createElement('h1');
  title.textContent = 'Ask Claw';
  title.style.cssText = 'font-size: 22px; margin: 0 0 4px;';
  container.appendChild(title);

  const date = document.createElement('p');
  date.textContent = new Date().toLocaleDateString();
  date.style.cssText = 'font-size: 12px; color: #666; margin: 0 0 20px;';
  container.appendChild(date);

  for (const msg of messages) {
    if (msg.role === 'error') continue;

    const heading = document.createElement('h3');
    heading.textContent = msg.role === 'user' ? 'User' : 'Assistant';
    heading.style.cssText = 'font-size: 13px; text-transform: uppercase; color: #888; margin: 16px 0 6px; letter-spacing: 0.5px;';
    container.appendChild(heading);

    if (msg.attachments && msg.attachments.length > 0) {
      for (const att of msg.attachments) {
        if (IMAGE_TYPES.has(att.content_type)) {
          const img = document.createElement('img');
          img.src = att.url;
          img.alt = att.filename;
          img.style.cssText = 'max-width: 100%; max-height: 300px; border-radius: 6px; margin: 4px 0;';
          container.appendChild(img);
        } else {
          const ref = document.createElement('p');
          ref.textContent = `[Attachment: ${att.filename}]`;
          ref.style.cssText = 'font-size: 13px; color: #666; margin: 4px 0;';
          container.appendChild(ref);
        }
      }
    }

    const body = document.createElement('div');
    if (msg.role === 'assistant') {
      body.innerHTML = renderMarkdown(msg.content);
    } else {
      body.style.whiteSpace = 'pre-wrap';
      body.textContent = msg.content;
    }
    body.style.cssText += 'font-size: 14px; line-height: 1.6;';
    container.appendChild(body);

    const hr = document.createElement('hr');
    hr.style.cssText = 'border: none; border-top: 1px solid #e0e0e0; margin: 16px 0;';
    container.appendChild(hr);
  }

  // Print-friendly code block styles
  const style = document.createElement('style');
  style.textContent = 'pre { white-space: pre-wrap !important; word-break: break-word; background: #f5f5f5; padding: 10px; border-radius: 6px; font-size: 13px; } code { font-size: 13px; } img { page-break-inside: avoid; }';
  container.appendChild(style);

  const html2pdf = (await import('html2pdf.js')).default;
  const dateStr = new Date().toISOString().slice(0, 10);
  await html2pdf().set({
    margin: [10, 10, 10, 10],
    filename: `askclaw-chat-${dateStr}.pdf`,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }).from(container).save();
}

export async function exportChatAsDocx(messages: DisplayMessage[]): Promise<void> {
  const docx = await import('docx');
  const { markdownToDocx } = await import('./markdown-to-docx');

  const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
  const dateStr = new Date().toISOString().slice(0, 10);

  const children: (InstanceType<typeof docx.Paragraph> | InstanceType<typeof docx.Table>)[] = [];

  // Title
  children.push(new docx.Paragraph({
    children: [new docx.TextRun({ text: 'Ask Claw', bold: true, size: 44 })],
    spacing: { after: 40 },
  }));

  // Date
  children.push(new docx.Paragraph({
    children: [new docx.TextRun({ text: new Date().toLocaleDateString(), size: 20, color: '666666' })],
    spacing: { after: 300 },
  }));

  for (const msg of messages) {
    if (msg.role === 'error') continue;

    // Role heading
    children.push(new docx.Paragraph({
      children: [new docx.TextRun({
        text: msg.role === 'user' ? 'USER' : 'ASSISTANT',
        size: 20,
        color: '888888',
        bold: true,
        allCaps: true,
      })],
      spacing: { before: 240, after: 80 },
    }));

    // Attachments
    if (msg.attachments && msg.attachments.length > 0) {
      for (const att of msg.attachments) {
        if (IMAGE_TYPES.has(att.content_type)) {
          try {
            const resp = await fetch(att.url);
            if (resp.ok) {
              const buf = await resp.arrayBuffer();
              // Detect dimensions
              const dims = await new Promise<{ width: number; height: number }>((resolve) => {
                const blob = new Blob([buf], { type: att.content_type });
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
                img.onerror = () => { URL.revokeObjectURL(url); resolve({ width: 400, height: 300 }); };
                img.src = url;
              });
              const maxWidth = 500;
              let w = dims.width, h = dims.height;
              if (w > maxWidth) { h = Math.round(h * (maxWidth / w)); w = maxWidth; }
              children.push(new docx.Paragraph({
                children: [new docx.ImageRun({ data: buf, transformation: { width: w, height: h }, type: 'png' })],
                spacing: { after: 80 },
              }));
            } else {
              children.push(new docx.Paragraph({
                children: [new docx.TextRun({ text: `[Image: ${att.filename}]`, italics: true, color: '888888' })],
                spacing: { after: 80 },
              }));
            }
          } catch {
            children.push(new docx.Paragraph({
              children: [new docx.TextRun({ text: `[Image: ${att.filename}]`, italics: true, color: '888888' })],
              spacing: { after: 80 },
            }));
          }
        } else {
          children.push(new docx.Paragraph({
            children: [new docx.TextRun({ text: `[Attachment: ${att.filename}]`, italics: true, color: '666666' })],
            spacing: { after: 80 },
          }));
        }
      }
    }

    // Content
    if (msg.role === 'assistant') {
      const paras = await markdownToDocx(msg.content, docx);
      children.push(...paras);
    } else {
      const lines = msg.content.split('\n');
      for (const line of lines) {
        children.push(new docx.Paragraph({
          children: [new docx.TextRun({ text: line })],
          spacing: { after: 40 },
        }));
      }
    }

    // Separator
    children.push(new docx.Paragraph({
      border: { bottom: { style: docx.BorderStyle.SINGLE, size: 6, color: 'E0E0E0' } },
      spacing: { before: 160, after: 160 },
    }));
  }

  const doc = new docx.Document({
    numbering: {
      config: [{
        reference: 'ordered-list',
        levels: [{
          level: 0,
          format: docx.LevelFormat.DECIMAL,
          text: '%1.',
          alignment: docx.AlignmentType.START,
        }],
      }],
    },
    sections: [{ children: children as InstanceType<typeof docx.Paragraph>[] }],
  });

  const blob = await docx.Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `askclaw-chat-${dateStr}.docx`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
