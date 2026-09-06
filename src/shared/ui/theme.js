export const THEME_STORAGE_KEY = "gdgjobs-theme";
export const THEMES = ["light", "dark", "system"];

const listeners = new Set();

export function subscribeTheme(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (THEMES.includes(value)) return value;
  } catch {
    /* private mode or blocked storage */
  }
  return "system";
}

export function applyTheme(theme = readStoredTheme(), { persist = false } = {}) {
  const next = THEMES.includes(theme) ? theme : "system";
  document.documentElement.setAttribute("data-theme", next);
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore quota / privacy errors */
    }
  }
  listeners.forEach((listener) => listener(next));
  return next;
}

export function initTheme() {
  return applyTheme(readStoredTheme(), { persist: false });
}
