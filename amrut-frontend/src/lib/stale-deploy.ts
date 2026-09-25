// A deploy replaces every hashed file under /assets. A tab that was left open still holds
// the previous build's chunk names, so the next lazy route it loads asks for a file that
// is no longer there. Reloading picks up the new index.html and, with it, the new names.

const RELOAD_KEY = "amrut:stale-deploy-reload-at";

// Long enough that a genuinely broken build cannot put the tab in a reload loop, short
// enough that a second deploy later in the same session still recovers on its own.
const RELOAD_COOLDOWN_MS = 30_000;

// The wording differs per browser, and a missing chunk can also come back as the SPA's
// index.html, which fails as a MIME type rather than a fetch.
const STALE_CHUNK_SIGNS = [
  "dynamically imported module",
  "importing a module script failed",
  "module script",
];

export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");

  return STALE_CHUNK_SIGNS.some((sign) => message.toLowerCase().includes(sign));
}

/** null when storage is blocked, which is the one case we cannot rule out a loop in. */
function lastReloadAt(): number | null {
  try {
    return Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
  } catch {
    return null;
  }
}

/** Whether a reload is worth trying, without performing one — safe to call while rendering. */
export function canReloadForNewVersion(): boolean {
  const last = lastReloadAt();

  // Offline, a reload only swaps this screen for the browser's own error page.
  if (last === null || !navigator.onLine) return false;

  return Date.now() - last >= RELOAD_COOLDOWN_MS;
}

/** Reloads at most once per cooldown, so a failure a reload cannot fix still surfaces. */
export function reloadForNewVersion(): void {
  if (!canReloadForNewVersion()) return;

  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return;
  }

  window.location.reload();
}

/** Vite raises this for any failed chunk load, including ones no router error boundary sees. */
export function listenForStaleChunks(): void {
  window.addEventListener("vite:preloadError", () => reloadForNewVersion());
}
