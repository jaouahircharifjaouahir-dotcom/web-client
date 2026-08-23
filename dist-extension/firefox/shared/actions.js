/** Download thumbnail blob directly — no downloads permission required. */

export async function downloadThumbnailBlob(candidate, filename) {
  let blob = candidate.blob;
  if (!blob) {
    const response = await fetch(candidate.url, { cache: "no-store" });
    if (!response.ok) throw new Error("DOWNLOAD_FAILED");
    blob = await response.blob();
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

export async function copyTextWithFeedback(text, button, defaultLabel) {
  try {
    await navigator.clipboard.writeText(text);
    const previous = button.textContent;
    button.textContent = "Copied!";
    button.disabled = true;
    setTimeout(() => {
      button.textContent = defaultLabel ?? previous;
      button.disabled = false;
    }, 1200);
    return true;
  } catch {
    return false;
  }
}
