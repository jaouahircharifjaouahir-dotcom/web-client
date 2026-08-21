export function resolutionScore(width: number | null, height: number | null): number {
  const pixels = (width ?? 0) * (height ?? 0);
  if (pixels >= 1280 * 720) return 100;
  if (pixels >= 640 * 480) return 78;
  if (pixels >= 480 * 360) return 62;
  if (pixels >= 320 * 180) return 48;
  if (pixels > 0) return 32;
  return 0;
}

export function contrastFromSamples(samples: Array<{ r: number; g: number; b: number }>): number {
  if (samples.length < 8) return 50;
  let min = 1;
  let max = 0;
  for (const pixel of samples) {
    const y = (0.2126 * pixel.r + 0.7152 * pixel.g + 0.0722 * pixel.b) / 255;
    min = Math.min(min, y);
    max = Math.max(max, y);
  }
  const range = max - min;
  return Math.round(Math.min(100, range * 120));
}

export function combineThumbnailScore(resolution: number, contrast: number): number {
  return Math.round(resolution * 0.65 + contrast * 0.35);
}
