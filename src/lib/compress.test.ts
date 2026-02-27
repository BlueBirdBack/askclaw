// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compressImage } from './compress';

// Minimal stub helpers
function makeFile(name: string, size: number, type: string): File {
  const buf = new Uint8Array(size);
  return new File([buf], name, { type });
}

// Shared mock state
let bitmapWidth = 800;
let bitmapHeight = 600;
let convertToBlobResult: Blob;

beforeEach(() => {
  bitmapWidth = 800;
  bitmapHeight = 600;
  convertToBlobResult = new Blob(['jpeg-data'], { type: 'image/jpeg' });

  // Mock createImageBitmap
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({
    width: bitmapWidth,
    height: bitmapHeight,
    close: vi.fn(),
  })));

  // Mock OffscreenCanvas
  vi.stubGlobal('OffscreenCanvas', vi.fn(() => ({
    getContext: () => ({ drawImage: vi.fn() }),
    convertToBlob: vi.fn(async () => convertToBlobResult),
  })));
});

describe('compressImage', () => {
  it('returns GIF files unchanged', async () => {
    const gif = makeFile('anim.gif', 1000, 'image/gif');
    const result = await compressImage(gif);
    expect(result).toBe(gif);
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it('returns small images unchanged (both dims <= maxDim and size <= 500KB)', async () => {
    const small = makeFile('tiny.png', 100 * 1024, 'image/png');
    bitmapWidth = 1024;
    bitmapHeight = 768;
    const result = await compressImage(small);
    expect(result).toBe(small);
  });

  it('compresses when size exceeds 500KB even if dimensions are small', async () => {
    const large = makeFile('big.png', 600 * 1024, 'image/png');
    bitmapWidth = 1024;
    bitmapHeight = 768;
    const result = await compressImage(large);
    expect(result).not.toBe(large);
    expect(result.type).toBe('image/jpeg');
    expect(result.name).toBe('big.jpg');
  });

  it('compresses and scales down when dimensions exceed maxDim', async () => {
    const photo = makeFile('photo.jpg', 200 * 1024, 'image/jpeg');
    bitmapWidth = 4000;
    bitmapHeight = 3000;

    const result = await compressImage(photo);
    expect(result).not.toBe(photo);
    expect(result.type).toBe('image/jpeg');

    // Verify OffscreenCanvas was created with scaled dimensions
    const canvasCalls = (OffscreenCanvas as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const [w, h] = canvasCalls[0];
    expect(w).toBeLessThanOrEqual(2048);
    expect(h).toBeLessThanOrEqual(2048);
    // Aspect ratio preserved: 4000:3000 = 4:3
    expect(Math.abs(w / h - 4 / 3)).toBeLessThan(0.02);
  });

  it('scales proportionally when only width exceeds maxDim', async () => {
    const wide = makeFile('pano.png', 100 * 1024, 'image/png');
    bitmapWidth = 5000;
    bitmapHeight = 1000;

    await compressImage(wide);

    const [w, h] = (OffscreenCanvas as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(w).toBe(2048);
    expect(h).toBe(Math.round(1000 * (2048 / 5000)));
  });

  it('scales proportionally when only height exceeds maxDim', async () => {
    const tall = makeFile('tall.png', 100 * 1024, 'image/png');
    bitmapWidth = 1000;
    bitmapHeight = 4000;

    await compressImage(tall);

    const [w, h] = (OffscreenCanvas as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(h).toBe(2048);
    expect(w).toBe(Math.round(1000 * (2048 / 4000)));
  });

  it('replaces file extension with .jpg', async () => {
    const png = makeFile('screenshot.png', 600 * 1024, 'image/png');
    bitmapWidth = 1024;
    bitmapHeight = 768;
    const result = await compressImage(png);
    expect(result.name).toBe('screenshot.jpg');
  });

  it('respects custom maxDim and quality parameters', async () => {
    const photo = makeFile('photo.jpg', 200 * 1024, 'image/jpeg');
    bitmapWidth = 2000;
    bitmapHeight = 1500;

    await compressImage(photo, 1024, 0.7);

    const [w, h] = (OffscreenCanvas as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(w).toBeLessThanOrEqual(1024);
    expect(h).toBeLessThanOrEqual(1024);
  });
});
