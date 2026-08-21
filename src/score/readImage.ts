import { combineThumbnailScore, contrastFromSamples, resolutionScore } from "./thumbnailScore";

export async function scorePublicThumbnail(
  url: string,
  width: number | null,
  height: number | null,
): Promise<{ score: number; notes: string[] }> {
  const resolution = resolutionScore(width, height);
  const notes = [`Resolution score ${resolution} from ${width ?? "?"}×${height ?? "?"}.`];
  try {
    const contrast = await sampleContrast(url);
    notes.push(`Contrast score ${contrast}.`);
    return { score: combineThumbnailScore(resolution, contrast), notes };
  } catch {
    notes.push("Contrast could not be read (image host CORS). Score uses resolution only.");
    return { score: resolution, notes };
  }
}

async function sampleContrast(url: string): Promise<number> {
  const image = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(image, 0, 0, 64, 64);
  const { data } = ctx.getImageData(0, 0, 64, 64);
  const samples = [];
  for (let i = 0; i < data.length; i += 16 * 4) {
    samples.push({ r: data[i] ?? 0, g: data[i + 1] ?? 0, b: data[i + 2] ?? 0 });
  }
  return contrastFromSamples(samples);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = url;
  });
}
