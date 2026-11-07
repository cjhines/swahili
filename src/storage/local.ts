// localStorage for per-device conveniences only (last setup choices, an unfinished run).
// Progress itself lives in IndexedDB. Every key is prefixed `swahili:` because the app shares
// the cjhin.es origin with the main site. Storage can throw (private browsing, blocked site
// data, quota), so every access is guarded and a failure just means "nothing remembered".

const PREFIX = 'swahili:';

export const readLocal = (key: string): unknown => {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
};

export const writeLocal = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Not remembering a convenience is fine.
  }
};

export const removeLocal = (key: string) => {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // As above.
  }
};
