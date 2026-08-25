/**
 * Detect build machine capabilities for local NLLB model selection.
 */
import os from "node:os";

export function detectHardware(_root = process.cwd()) {
  const ramGiB = Math.round(os.totalmem() / (1024 ** 3));
  const cpus = os.cpus().length;
  return {
    platform: process.platform,
    arch: process.arch,
    cpus,
    ramGiB,
    freeDiskGiB: null,
    node: process.version,
  };
}

/** Pick a practical local model for this machine. */
export function selectNllbModel(hw = detectHardware()) {
  if (hw.ramGiB >= 16) {
    return {
      modelId: "Xenova/nllb-200-distilled-600M",
      dtype: "q8",
      estimatedDownloadMiB: 700,
      note: "600M distilled, q8 — balanced quality on 16GB+ RAM",
    };
  }
  if (hw.ramGiB >= 8) {
    return {
      modelId: "Xenova/nllb-200-distilled-600M",
      dtype: "q8",
      estimatedDownloadMiB: 700,
      note: "600M distilled, q8 — recommended for 8GB RAM (sequential jobs only)",
    };
  }
  return {
    modelId: "Xenova/nllb-200-distilled-600M",
    dtype: "q4",
    estimatedDownloadMiB: 400,
    note: "600M distilled, q4 — low RAM fallback",
  };
}

export function estimateFullRolloutRuntime({
  jobCount,
  avgSecondsPerJob = 90,
  modelLoadSeconds = 60,
}) {
  const totalSeconds = modelLoadSeconds + jobCount * avgSecondsPerJob;
  return {
    jobCount,
    avgSecondsPerJob,
    modelLoadSeconds,
    estimatedHours: Number((totalSeconds / 3600).toFixed(1)),
    estimatedMinutes: Math.round(totalSeconds / 60),
  };
}
