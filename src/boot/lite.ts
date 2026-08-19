/** Tiny first-paint boot: drop Blogger ?m=1 and leftover workers. Do not wipe HTTP cache. */

export function bootLite(): void {
  stripBloggerMobileView();
  dropServiceWorkers();
}

function stripBloggerMobileView(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("m")) return;
  url.searchParams.delete("m");
  const search = url.searchParams.toString();
  window.location.replace(`${url.pathname}${search ? `?${search}` : ""}${url.hash}`);
}

function dropServiceWorkers(): void {
  if (!("serviceWorker" in navigator)) return;
  void navigator.serviceWorker.getRegistrations().then((list) => {
    for (const registration of list) void registration.unregister();
  });
}
