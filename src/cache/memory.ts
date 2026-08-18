const memory = new Map<string, unknown>();

export const resultCache = {
  get<T>(key: string): T | undefined {
    return memory.get(key) as T | undefined;
  },
  set<T>(key: string, value: T): void {
    memory.set(key, value);
  },
  has(key: string): boolean {
    return memory.has(key);
  },
  clear(): void {
    memory.clear();
  },
};
