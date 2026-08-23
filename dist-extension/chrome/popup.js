import { classifyYouTubeTab } from "./shared/youtube.js";
import {
  discoverBestThumbnail,
  downloadFilename,
  formatQualityLabel,
} from "./shared/thumbnails.js";
import {
  copy11tikLink,
  copyImageUrl,
  open11tikUrl,
  openFullResolutionUrl,
} from "./shared/share.js";
import { copyTextWithFeedback, downloadThumbnailBlob } from "./shared/actions.js";

const api = globalThis.browser ?? globalThis.chrome;

const statusEl = document.getElementById("status");
const previewWrap = document.getElementById("preview-wrap");
const previewEl = document.getElementById("preview");
const qualityEl = document.getElementById("quality");
const videoIdEl = document.getElementById("video-id");
const actionsEl = document.getElementById("actions");

const btnDownload = document.getElementById("btn-download");
const btnCopyUrl = document.getElementById("btn-copy-url");
const btnCopyShare = document.getElementById("btn-copy-share");
const btnOpen11tik = document.getElementById("btn-open-11tik");
const btnOpenFull = document.getElementById("btn-open-full");

const COPY_LABELS = {
  url: "Copy image URL",
  share: "Copy 11tik link",
};

/** @type {{ videoId: string, best: any } | null} */
let state = null;

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = `status${kind ? ` ${kind}` : ""}`;
}

function show(el) {
  el.hidden = false;
  el.classList.remove("hidden");
}

function hide(el) {
  el.hidden = true;
  el.classList.add("hidden");
}

function resetResults() {
  state = null;
  hide(previewWrap);
  hide(videoIdEl);
  hide(actionsEl);
  previewEl.removeAttribute("src");
}

function wireActions() {
  btnDownload.addEventListener("click", async () => {
    if (!state?.best || !state.videoId) return;
    try {
      await downloadThumbnailBlob(state.best, downloadFilename(state.videoId, state.best));
    } catch {
      setStatus("Download failed. Try Open full resolution instead.", "error");
    }
  });

  btnCopyUrl.addEventListener("click", async () => {
    if (!state?.best) return;
    const ok = await copyTextWithFeedback(copyImageUrl(state.best), btnCopyUrl, COPY_LABELS.url);
    if (!ok) setStatus("Could not copy to clipboard.", "error");
  });

  btnCopyShare.addEventListener("click", async () => {
    if (!state?.videoId) return;
    const ok = await copyTextWithFeedback(copy11tikLink(state.videoId), btnCopyShare, COPY_LABELS.share);
    if (!ok) setStatus("Could not copy to clipboard.", "error");
  });

  btnOpen11tik.addEventListener("click", () => {
    if (!state?.videoId) return;
    const url = open11tikUrl(state.videoId);
    if (!url) return;
    void api.tabs.create({ url });
  });

  btnOpenFull.addEventListener("click", () => {
    if (!state?.best) return;
    const url = openFullResolutionUrl(state.best);
    if (!url) return;
    void api.tabs.create({ url });
  });
}

async function boot() {
  wireActions();
  resetResults();

  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  const tabState = classifyYouTubeTab(tab?.url || "");

  if (tabState.kind !== "video" || !tabState.videoId) {
    setStatus(tabState.message || "11tik supports YouTube only.", "error");
    return;
  }

  const videoId = tabState.videoId;
  videoIdEl.textContent = `Video ID: ${videoId}`;
  show(videoIdEl);
  setStatus("Finding the best public thumbnail…");

  const abort = new AbortController();
  const { best } = await discoverBestThumbnail(videoId, abort.signal);
  if (!best) {
    setStatus("No public thumbnail was found for this video.", "error");
    return;
  }

  state = { videoId, best };
  previewEl.src = best.url;
  previewEl.width = best.width;
  previewEl.height = best.height;
  qualityEl.textContent = formatQualityLabel(best);
  show(previewWrap);
  show(actionsEl);
  setStatus("Best available public thumbnail ready.", "ok");
}

void boot();
