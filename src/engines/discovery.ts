import type { ThumbnailCandidate } from "../types";
import { isVisuallyDuplicate, validateThumbnail } from "../validators/thumbnail";
import { rankCandidate, sortRanked } from "../ranking/ranker";
import { allCandidates } from "./strategies";

export type DiscoveryProgress = (state: {
  best: ThumbnailCandidate | null;
  valid: ThumbnailCandidate[];
  failed: ThumbnailCandidate[];
}) => void;

export class ThumbnailDiscoveryEngine {
  async discover(
    videoId: string,
    signal: AbortSignal,
    onProgress?: DiscoveryProgress,
  ): Promise<{ valid: ThumbnailCandidate[]; failed: ThumbnailCandidate[] }> {
    const pending = allCandidates(videoId);
    const valid: ThumbnailCandidate[] = [];
    const failed: ThumbnailCandidate[] = [];

    const publish = () => {
      onProgress?.({
        best: sortRanked(valid)[0] ?? null,
        valid: sortRanked(valid),
        failed: [...failed],
      });
    };

    for (const candidate of pending) {
      if (signal.aborted) break;
      const checked = rankCandidate(await validateThumbnail(candidate, signal));
      if (checked.valid) {
        const duplicate = valid.some((item) => isVisuallyDuplicate(item, checked));
        if (!duplicate) {
          valid.push(checked);
          publish();
        } else {
          failed.push({ ...checked, valid: false, failureReason: "duplicate" });
        }
      } else {
        failed.push(checked);
      }
    }

    return { valid: sortRanked(valid), failed };
  }
}

export const thumbnailDiscoveryEngine = new ThumbnailDiscoveryEngine();
