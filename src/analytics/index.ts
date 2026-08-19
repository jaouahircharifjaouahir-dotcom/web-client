export type AnalyticsEvent =
  | "extraction_started"
  | "extraction_success"
  | "extraction_failure"
  | "download_clicked"
  | "copy_clicked"
  | "bulk_mode_used"
  | "power_mode_opened";

type Listener = (event: AnalyticsEvent, payload?: Record<string, string | number | boolean>) => void;

const listeners: Listener[] = [];

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function sendGtag(name: string, payload?: Record<string, string | number | boolean>): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, payload);
}

export const analytics = {
  track(event: AnalyticsEvent, payload?: Record<string, string | number | boolean>): void {
    sendGtag(event, payload);
    for (const listener of listeners) listener(event, payload);
  },
  pageView(): void {
    sendGtag("page_view", {
      page_location: location.href,
      page_title: document.title,
    });
  },
  subscribe(listener: Listener): () => void {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    };
  },
};
