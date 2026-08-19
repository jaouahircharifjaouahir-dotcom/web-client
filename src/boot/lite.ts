/** Hide Blogger ?m=1 in the address bar without reloading (replaceState only). */

export function bootLite(): void {
  hideBloggerMobileParam();
  dropServiceWorkers();
}

function hideBloggerMobileParam(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("m")) return;
    url.searchParams.delete("m");
    const search = url.searchParams.toString();
    window.history.replaceState({}, document.title, `${url.pathname}${search ? `?${search}` : ""}${url.hash}`);
  } catch {
    /* ignore */
  }
}

function dropServiceWorkers(): void {
  if (!("serviceWorker" in navigator)) return;
  void navigator.serviceWorker.getRegistrations().then((list) => {
    for (const registration of list) void registration.unregister();
  });
}
