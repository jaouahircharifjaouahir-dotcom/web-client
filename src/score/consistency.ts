function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = url;
  });
}

export async function getDominantColors(imageUrl: string, sampleSize = 5): Promise<number[][]> {
  const img = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = 50;
  canvas.height = 50;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, 50, 50);
  const { data } = ctx.getImageData(0, 0, 50, 50);
  const buckets: Record<string, number> = {};
  for (let i = 0; i < data.length; i += 4) {
    const r = Math.round((data[i] ?? 0) / 32) * 32;
    const g = Math.round((data[i + 1] ?? 0) / 32) * 32;
    const b = Math.round((data[i + 2] ?? 0) / 32) * 32;
    const key = `${r},${g},${b}`;
    buckets[key] = (buckets[key] || 0) + 1;
  }
  return Object.entries(buckets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, sampleSize)
    .map(([rgb]) => rgb.split(",").map(Number));
}

function colorDistance(c1: number[], c2: number[]): number {
  return Math.sqrt((c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2 + (c1[2] - c2[2]) ** 2);
}

export async function calculateConsistencyScore(thumbnailUrls: string[]): Promise<{ score: number } | null> {
  const urls = thumbnailUrls.filter(Boolean).slice(0, 12);
  if (urls.length < 2) return null;
  try {
    const palettes = await Promise.all(urls.map((url) => getDominantColors(url, 3)));
    const reference = palettes[0] || [];
    if (!reference.length) return null;
    let total = 0;
    let n = 0;
    for (let i = 1; i < palettes.length; i += 1) {
      for (const a of reference) {
        for (const b of palettes[i] || []) {
          total += colorDistance(a, b);
          n += 1;
        }
      }
    }
    if (!n) return null;
    const score = Math.max(0, Math.min(100, Math.round(100 - total / n / 4.4)));
    return { score };
  } catch {
    return null;
  }
}

export async function getNicheBenchmark(_tagSlug: string): Promise<null> {
  return null;
}
