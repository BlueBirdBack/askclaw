const MAX_COMPRESSED_SIZE = 500 * 1024; // 500KB — skip compression if already small

export async function compressImage(
  file: File,
  maxDim = 2048,
  quality = 0.85,
): Promise<File> {
  // Preserve animated GIFs
  if (file.type === 'image/gif') return file;

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  // Already small enough — no compression needed
  if (width <= maxDim && height <= maxDim && file.size <= MAX_COMPRESSED_SIZE) {
    bitmap.close();
    return file;
  }

  // Calculate scaled dimensions preserving aspect ratio
  let newWidth = width;
  let newHeight = height;
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    newWidth = Math.round(width * ratio);
    newHeight = Math.round(height * ratio);
  }

  // Draw onto canvas and export as JPEG
  const canvas = new OffscreenCanvas(newWidth, newHeight);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });

  // Replace extension with .jpg
  const name = file.name.replace(/\.[^.]+$/, '.jpg');
  return new File([blob], name, { type: 'image/jpeg' });
}
