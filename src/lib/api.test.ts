// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileAsBase64, uploadFiles, streamChat } from './api';

// --- readFileAsBase64 ---

describe('readFileAsBase64', () => {
  it('converts a JPEG file to correct media_type and base64 data', async () => {
    const file = new File(['fake-jpeg-data'], 'photo.jpg', { type: 'image/jpeg' });
    const result = await readFileAsBase64(file);
    expect(result.media_type).toBe('image/jpeg');
    expect(result.data).toBeTruthy();
    // data should be valid base64 (no data: prefix)
    expect(result.data).not.toContain('data:');
  });

  it('converts a PNG file with correct media_type', async () => {
    const file = new File(['fake-png-data'], 'screenshot.png', { type: 'image/png' });
    const result = await readFileAsBase64(file);
    expect(result.media_type).toBe('image/png');
    expect(result.data).toBeTruthy();
  });

  it('rejects when FileReader errors', async () => {
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });

    // Mock FileReader to trigger error
    const OriginalFileReader = globalThis.FileReader;
    globalThis.FileReader = class MockFileReader {
      onerror: ((ev: any) => void) | null = null;
      onload: ((ev: any) => void) | null = null;
      error = new DOMException('Read failed');
      result = null;
      readAsDataURL() {
        setTimeout(() => {
          if (this.onerror) this.onerror(new Event('error'));
        }, 0);
      }
    } as any;

    await expect(readFileAsBase64(file)).rejects.toBeTruthy();
    globalThis.FileReader = OriginalFileReader;
  });
});

// --- uploadFiles ---

describe('uploadFiles', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON array on success', async () => {
    const mockResponse = [
      { id: 'abc', filename: 'img.jpg', content_type: 'image/jpeg', size: 100, url: '/api/files/abc' },
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const files = [new File(['data'], 'img.jpg', { type: 'image/jpeg' })];
    const result = await uploadFiles(files);
    expect(result).toEqual(mockResponse);
  });

  it('throws Error on HTTP 500', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const files = [new File(['data'], 'img.jpg', { type: 'image/jpeg' })];
    await expect(uploadFiles(files)).rejects.toThrow('Upload failed: 500');
  });
});

// --- streamChat SSE ---

describe('streamChat', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses delta events and calls onChunk/onDone', async () => {
    const chunks: string[] = [];
    let doneText = '';

    const sseBody = [
      'data: {"delta":"Hello"}\n\n',
      'data: {"delta":" world"}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseBody));
        controller.close();
      },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: stream,
    } as Response);

    await streamChat(
      [{ role: 'user', content: 'Hi' }],
      'openclaw:main',
      'testuser',
      {
        onChunk: (acc) => chunks.push(acc),
        onDone: (full) => { doneText = full; },
        onError: () => {},
      },
    );

    expect(chunks).toContain('Hello');
    expect(chunks).toContain('Hello world');
    expect(doneText).toBe('Hello world');
  });

  it('calls onError("network") when fetch throws', async () => {
    let errorMsg = '';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await streamChat(
      [{ role: 'user', content: 'Hi' }],
      'openclaw:main',
      'testuser',
      {
        onChunk: () => {},
        onDone: () => {},
        onError: (msg) => { errorMsg = msg; },
      },
    );

    expect(errorMsg).toBe('network');
  });

  it('calls onError with status code on HTTP 429', async () => {
    let errorMsg = '';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 429,
    } as Response);

    await streamChat(
      [{ role: 'user', content: 'Hi' }],
      'openclaw:main',
      'testuser',
      {
        onChunk: () => {},
        onDone: () => {},
        onError: (msg) => { errorMsg = msg; },
      },
    );

    expect(errorMsg).toBe('429');
  });
});
