import type { HistoryEntry } from "../types";

const KEY = "yte-history-v1";
const LIMIT = 24;

function read(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: HistoryEntry[]): void {
  localStorage.setItem(KEY, JSON.stringify(entries.slice(0, LIMIT)));
}

export const historyStore = {
  list(): HistoryEntry[] {
    return read();
  },
  save(entry: HistoryEntry): HistoryEntry[] {
    const next = [entry, ...read().filter((item) => item.videoId !== entry.videoId)].slice(0, LIMIT);
    write(next);
    return next;
  },
  clear(): HistoryEntry[] {
    write([]);
    return [];
  },
};
