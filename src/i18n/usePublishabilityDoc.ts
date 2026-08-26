import { useEffect, useState } from "react";
import {
  getPublishabilityCache,
  loadPublishability,
  subscribePublishability,
  type PublishabilityDoc,
} from "./publishability";

/**
 * Returns the publishability manifest once loaded and re-renders subscribers
 * when the async fetch completes (so guidePosts() can rewrite hrefs).
 */
export function usePublishabilityDoc(): PublishabilityDoc | null {
  const [doc, setDoc] = useState<PublishabilityDoc | null>(() => getPublishabilityCache());
  useEffect(() => {
    void loadPublishability();
    return subscribePublishability(setDoc);
  }, []);
  return doc;
}
