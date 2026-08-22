import { enforceHomeHost, watchCopyNotice } from "../rights/hostGuard";

/** Hide Blogger ?m=1 in the address bar without reloading (replaceState only). */

type CookieChoices = {
  showCookieConsentBar?: (...args: unknown[]) => void;
  showCookieConsentDialog?: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    cookieChoices?: CookieChoices;
    cookieOptions?: Record<string, unknown>;
    __yteRights?: number;
  }
}

export function bootLite(): void {
  enforceHomeHost();
  watchCopyNotice();
  hideBloggerMobileParam();
  dropServiceWorkers();
  disableBloggerCookieNotice();
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

/** Blogger injects /js/cookienotice.js. Empty cookieOptions + a no-op cookieChoices stop the grey bar. */
function disableBloggerCookieNotice(): void {
  const mute = (): void => {
    window.cookieOptions = {};
    window.cookieChoices = {
      showCookieConsentBar() {},
      showCookieConsentDialog() {},
    };
    document.querySelectorAll("#cookieChoiceInfo, #cookieChoiceDismiss, .cookie-choices-info, #cookieBar, .cookieBar").forEach((node) => {
      node.remove();
    });
    try {
      document.cookie = "displayCookieNotice=y; path=/; max-age=31536000; SameSite=Lax";
    } catch {
      /* ignore */
    }
  };

  mute();
  document.addEventListener("DOMContentLoaded", mute);
  if (typeof MutationObserver !== "undefined") {
    new MutationObserver(mute).observe(document.documentElement, { childList: true, subtree: true });
  }
}
