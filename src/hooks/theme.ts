const KEY = "yte-theme";

export type ThemeMode = "light" | "dark" | "system";

export function readTheme(): ThemeMode {
  const value = localStorage.getItem(KEY);
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function resolvedTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "light" || mode === "dark") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function saveTheme(mode: ThemeMode): void {
  localStorage.setItem(KEY, mode);
}
