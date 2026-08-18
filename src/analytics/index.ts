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

export const analytics = {
  track(event: AnalyticsEvent, payload?: Record<string, string | number | boolean>): void {
    for (const listener of listeners) listener(event, payload);
  },
  subscribe(listener: Listener): () => void {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    };
  },
};
