import { Marked } from 'marked';
import type { Token, Tokens } from 'marked';

type Docx = typeof import('docx');

interface InlineStyle {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
}

/** Collect all image URLs from markdown tokens */
function collectImageUrls(tokens: Token[]): string[] {
  const urls: string[] = [];
  for (const token of tokens) {
    if (token.type === 'image') {
      urls.push((token as Tokens.Image).href);
    }
    if ('tokens' in token && Array.isArray(token.tokens)) {
      urls.push(...collectImageUrls(token.tokens));
    }
    if ('items' in token && Array.isArray((token as Tokens.List).items)) {
      for (const item of (token as Tokens.List).items) {
        urls.push(...collectImageUrls(item.tokens));
      }
    }
  }
  return urls;
}

/** Fetch image as ArrayBuffer, return null on failure */
async function fetchImage(url: string): Promise<ArrayBuffer | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return await resp.arrayBuffer();
  } catch {
    return null;
  }
}

/** Get image dimensions from a blob URL */
function getImageDimensions(buf: ArrayBuffer, contentType: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const blob = new Blob([buf], { type: contentType });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 400, height: 300 });
    };
    img.src = url;
  });
}

/** Convert inline tokens to TextRun[] with inherited styles */
function convertInline(
  tokens: Token[],
  docx: Docx,
  style: InlineStyle,
  images: Map<string, { data: ArrayBuffer; width: number; height: number }>,
): (InstanceType<typeof docx.TextRun> | InstanceType<typeof docx.ImageRun> | InstanceType<typeof docx.ExternalHyperlink>)[] {
  const runs: (InstanceType<typeof docx.TextRun> | InstanceType<typeof docx.ImageRun> | InstanceType<typeof docx.ExternalHyperlink>)[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'text': {
        const t = token as Tokens.Text;
        if (t.tokens) {
          runs.push(...convertInline(t.tokens, docx, style, images));
        } else {
          runs.push(new docx.TextRun({ text: t.text, ...style }));
        }
        break;
      }
      case 'strong': {
        const t = token as Tokens.Strong;
        runs.push(...convertInline(t.tokens, docx, { ...style, bold: true }, images));
        break;
      }
      case 'em': {
        const t = token as Tokens.Em;
        runs.push(...convertInline(t.tokens, docx, { ...style, italics: true }, images));
        break;
      }
      case 'del': {
        const t = token as Tokens.Del;
        runs.push(...convertInline(t.tokens, docx, { ...style, strike: true }, images));
        break;
      }
      case 'codespan': {
        const t = token as Tokens.Codespan;
        runs.push(new docx.TextRun({
          text: t.text,
          font: 'Courier New',
          ...style,
        }));
        break;
      }
      case 'link': {
        const t = token as Tokens.Link;
        const linkChildren = convertInline(t.tokens, docx, { ...style, color: '0563C1' } as InlineStyle, images);
        runs.push(new docx.ExternalHyperlink({
          link: t.href,
          children: linkChildren.map(r => {
            if (r instanceof docx.TextRun) return r;
            return new docx.TextRun({ text: t.text, ...style });
          }),
        }));
        break;
      }
      case 'image': {
        const t = token as Tokens.Image;
        const imgData = images.get(t.href);
        if (imgData) {
          const maxWidth = 500;
          let w = imgData.width;
          let h = imgData.height;
          if (w > maxWidth) {
            h = Math.round(h * (maxWidth / w));
            w = maxWidth;
          }
          runs.push(new docx.ImageRun({
            data: imgData.data,
            transformation: { width: w, height: h },
            type: 'png',
          }));
        } else {
          runs.push(new docx.TextRun({ text: `[Image: ${t.href}]`, italics: true, color: '888888' }));
        }
        break;
      }
      case 'br':
        runs.push(new docx.TextRun({ text: '', break: 1 }));
        break;
      default:
        if ('raw' in token) {
          runs.push(new docx.TextRun({ text: (token as { raw: string }).raw, ...style }));
        }
    }
  }

  return runs;
}

/** Convert block-level tokens to Paragraph[] */
function convertBlocks(
  tokens: Token[],
  docx: Docx,
  images: Map<string, { data: ArrayBuffer; width: number; height: number }>,
): InstanceType<typeof docx.Paragraph>[] {
  const paragraphs: InstanceType<typeof docx.Paragraph>[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'paragraph': {
        const t = token as Tokens.Paragraph;
        paragraphs.push(new docx.Paragraph({
          children: convertInline(t.tokens, docx, {}, images),
          spacing: { after: 120 },
        }));
        break;
      }
      case 'heading': {
        const t = token as Tokens.Heading;
        const headingMap: Record<number, (typeof docx.HeadingLevel)[keyof typeof docx.HeadingLevel]> = {
          1: docx.HeadingLevel.HEADING_1,
          2: docx.HeadingLevel.HEADING_2,
          3: docx.HeadingLevel.HEADING_3,
          4: docx.HeadingLevel.HEADING_4,
          5: docx.HeadingLevel.HEADING_5,
          6: docx.HeadingLevel.HEADING_6,
        };
        paragraphs.push(new docx.Paragraph({
          children: convertInline(t.tokens, docx, { bold: true }, images),
          heading: headingMap[t.depth] || docx.HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 120 },
        }));
        break;
      }
      case 'code': {
        const t = token as Tokens.Code;
        const lines = t.text.split('\n');
        for (const line of lines) {
          paragraphs.push(new docx.Paragraph({
            children: [new docx.TextRun({
              text: line || ' ',
              font: 'Courier New',
              size: 20,
            })],
            shading: { type: docx.ShadingType.SOLID, color: 'F5F5F5', fill: 'F5F5F5' },
            spacing: { after: 0 },
          }));
        }
        paragraphs.push(new docx.Paragraph({ spacing: { after: 120 } }));
        break;
      }
      case 'list': {
        const t = token as Tokens.List;
        for (let i = 0; i < t.items.length; i++) {
          const item = t.items[i];
          const inlineRuns = convertInline(item.tokens, docx, {}, images);
          paragraphs.push(new docx.Paragraph({
            children: inlineRuns,
            numbering: t.ordered
              ? { reference: 'ordered-list', level: 0 }
              : undefined,
            bullet: t.ordered ? undefined : { level: 0 },
            spacing: { after: 60 },
          }));
        }
        paragraphs.push(new docx.Paragraph({ spacing: { after: 80 } }));
        break;
      }
      case 'blockquote': {
        const t = token as Tokens.Blockquote;
        // Flatten blockquote inner tokens into inline runs for a single indented paragraph
        const bqRuns: (InstanceType<typeof docx.TextRun> | InstanceType<typeof docx.ImageRun> | InstanceType<typeof docx.ExternalHyperlink>)[] = [];
        for (const inner of t.tokens) {
          if (inner.type === 'paragraph' && 'tokens' in inner) {
            if (bqRuns.length > 0) bqRuns.push(new docx.TextRun({ text: '', break: 1 }));
            bqRuns.push(...convertInline((inner as Tokens.Paragraph).tokens, docx, {}, images));
          }
        }
        paragraphs.push(new docx.Paragraph({
          children: bqRuns,
          indent: { left: 720 },
          border: { left: { style: docx.BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 10 } },
          spacing: { after: 120 },
        }));
        break;
      }
      case 'table': {
        const t = token as Tokens.Table;
        const rows: InstanceType<typeof docx.TableRow>[] = [];
        // Header row
        rows.push(new docx.TableRow({
          children: t.header.map(cell => new docx.TableCell({
            children: [new docx.Paragraph({
              children: convertInline(cell.tokens, docx, { bold: true }, images),
            })],
            shading: { type: docx.ShadingType.SOLID, color: 'F0F0F0', fill: 'F0F0F0' },
          })),
        }));
        // Data rows
        for (const row of t.rows) {
          rows.push(new docx.TableRow({
            children: row.map(cell => new docx.TableCell({
              children: [new docx.Paragraph({
                children: convertInline(cell.tokens, docx, {}, images),
              })],
            })),
          }));
        }
        paragraphs.push(new docx.Table({
          rows,
          width: { size: 100, type: docx.WidthType.PERCENTAGE },
        }) as unknown as InstanceType<typeof docx.Paragraph>);
        paragraphs.push(new docx.Paragraph({ spacing: { after: 120 } }));
        break;
      }
      case 'hr':
        paragraphs.push(new docx.Paragraph({
          border: { bottom: { style: docx.BorderStyle.SINGLE, size: 6, color: 'E0E0E0' } },
          spacing: { before: 120, after: 120 },
        }));
        break;
      case 'space':
        break;
      default:
        if ('raw' in token && (token as { raw: string }).raw.trim()) {
          paragraphs.push(new docx.Paragraph({
            children: [new docx.TextRun({ text: (token as { raw: string }).raw })],
            spacing: { after: 120 },
          }));
        }
    }
  }

  return paragraphs;
}

/**
 * Convert a markdown string to docx Paragraph[].
 * The `docx` module is passed in (already dynamically loaded by the caller).
 */
export async function markdownToDocx(
  markdown: string,
  docx: Docx,
): Promise<InstanceType<typeof docx.Paragraph>[]> {
  const marked = new Marked({ gfm: true, breaks: true });
  const tokens = marked.lexer(markdown);

  // Collect and fetch images
  const imageUrls = [...new Set(collectImageUrls(tokens))];
  const imageMap = new Map<string, { data: ArrayBuffer; width: number; height: number }>();

  if (imageUrls.length > 0) {
    const results = await Promise.all(imageUrls.map(async (url) => {
      const data = await fetchImage(url);
      if (!data) return null;
      const dims = await getImageDimensions(data, 'image/png');
      return { url, data, ...dims };
    }));
    for (const r of results) {
      if (r) imageMap.set(r.url, { data: r.data, width: r.width, height: r.height });
    }
  }

  return convertBlocks(tokens, docx, imageMap);
}
