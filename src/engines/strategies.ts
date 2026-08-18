import type { StrategyResult } from "../types";
import { QUALITY_PRESETS, presetCandidate } from "./presets";

export type StrategyName = "primary" | "high-quality" | "standard" | "alternative" | "fallback";

export interface Strategy {
  name: StrategyName;
  confidence: number;
  run(videoId: string): StrategyResult;
}

const primary: Strategy = {
  name: "primary",
  confidence: 0.95,
  run(videoId) {
    const presets = QUALITY_PRESETS.filter((p) => p.tier === "best");
    return {
      videoId,
      strategy: this.name,
      confidence: this.confidence,
      errors: [],
      candidates: presets.map((preset) => presetCandidate(videoId, preset, this.name)),
    };
  },
};

const highQuality: Strategy = {
  name: "high-quality",
  confidence: 0.85,
  run(videoId) {
    const presets = QUALITY_PRESETS.filter((p) => p.tier === "high");
    return {
      videoId,
      strategy: this.name,
      confidence: this.confidence,
      errors: [],
      candidates: presets.map((preset) => presetCandidate(videoId, preset, this.name)),
    };
  },
};

const standard: Strategy = {
  name: "standard",
  confidence: 0.7,
  run(videoId) {
    const presets = QUALITY_PRESETS.filter((p) => p.quality === "hq");
    return {
      videoId,
      strategy: this.name,
      confidence: this.confidence,
      errors: [],
      candidates: presets.map((preset) => presetCandidate(videoId, preset, this.name)),
    };
  },
};

const alternative: Strategy = {
  name: "alternative",
  confidence: 0.55,
  run(videoId) {
    const presets = QUALITY_PRESETS.filter((p) => p.quality === "mq");
    return {
      videoId,
      strategy: this.name,
      confidence: this.confidence,
      errors: [],
      candidates: presets.map((preset) => presetCandidate(videoId, preset, this.name)),
    };
  },
};

const fallback: Strategy = {
  name: "fallback",
  confidence: 0.4,
  run(videoId) {
    const presets = QUALITY_PRESETS.filter((p) => p.quality === "default");
    return {
      videoId,
      strategy: this.name,
      confidence: this.confidence,
      errors: [],
      candidates: presets.map((preset) => presetCandidate(videoId, preset, this.name)),
    };
  },
};

export const strategyRegistry: Strategy[] = [primary, highQuality, standard, alternative, fallback];

export function allCandidates(videoId: string) {
  const seen = new Set<string>();
  const list = [];
  for (const strategy of strategyRegistry) {
    for (const candidate of strategy.run(videoId).candidates) {
      if (seen.has(candidate.url)) continue;
      seen.add(candidate.url);
      list.push(candidate);
    }
  }
  return list;
}
