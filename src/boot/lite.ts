/** First-paint boot: do not redirect ?m=1 (that fights Blogger and reloads forever). */

export function bootLite(): void {
  dropServiceWorkers();
}

function dropServiceWorkers(): void {
  if (!("serviceWorker" in navigator)) return;
  void navigator.serviceWorker.getRegistrations().then((list) => {
    for (const registration of list) void registration.unregister();
  });
}
