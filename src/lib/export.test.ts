// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportChatAsMarkdown } from './export';
import type { DisplayMessage } from './types';

describe('exportChatAsMarkdown', () => {
  beforeEach(() => {
    // jsdom doesn't implement these — define stubs before spying
    if (!URL.createObjectURL) {
      URL.createObjectURL = () => '';
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = () => {};
    }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('formats basic messages with User/Assistant headings', () => {
    let capturedHref = '';
    const mockClick = vi.fn();

    vi.spyOn(document, 'createElement').mockReturnValue({
      set href(v: string) { capturedHref = v; },
      get href() { return capturedHref; },
      download: '',
      click: mockClick,
    } as any);

    const blobParts: BlobPart[] = [];
    const OriginalBlob = globalThis.Blob;
    vi.spyOn(globalThis, 'Blob').mockImplementation(function (parts?: BlobPart[], options?: BlobPropertyBag) {
      if (parts) blobParts.push(...parts);
      return new OriginalBlob(parts, options);
    } as any);

    const messages: DisplayMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];

    exportChatAsMarkdown(messages);

    const text = blobParts.join('');
    expect(text).toContain('## User');
    expect(text).toContain('Hello');
    expect(text).toContain('## Assistant');
    expect(text).toContain('Hi there!');
    expect(mockClick).toHaveBeenCalled();
  });

  it('includes image refs for messages with attachments', () => {
    const blobParts: BlobPart[] = [];
    const OriginalBlob = globalThis.Blob;
    vi.spyOn(globalThis, 'Blob').mockImplementation(function (parts?: BlobPart[], options?: BlobPropertyBag) {
      if (parts) blobParts.push(...parts);
      return new OriginalBlob(parts, options);
    } as any);
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '', download: '', click: vi.fn(),
    } as any);

    const messages: DisplayMessage[] = [
      {
        role: 'user',
        content: 'Check this out',
        attachments: [
          { id: 'a1', filename: 'photo.jpg', content_type: 'image/jpeg', size: 100, url: '/api/files/a1' },
        ],
      },
    ];

    exportChatAsMarkdown(messages);

    const text = blobParts.join('');
    expect(text).toContain('![photo.jpg](/api/files/a1)');
    expect(text).toContain('Check this out');
  });

  it('skips error messages', () => {
    const blobParts: BlobPart[] = [];
    const OriginalBlob = globalThis.Blob;
    vi.spyOn(globalThis, 'Blob').mockImplementation(function (parts?: BlobPart[], options?: BlobPropertyBag) {
      if (parts) blobParts.push(...parts);
      return new OriginalBlob(parts, options);
    } as any);
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '', download: '', click: vi.fn(),
    } as any);

    const messages: DisplayMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'error', content: 'Something went wrong' },
      { role: 'assistant', content: 'World' },
    ];

    exportChatAsMarkdown(messages);

    const text = blobParts.join('');
    expect(text).not.toContain('Something went wrong');
    expect(text).toContain('Hello');
    expect(text).toContain('World');
  });
});
