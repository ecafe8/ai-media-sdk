/**
 * Locale resolution for the site. Pure functions only (no i18next import)
 * so detection/persistence can be unit tested and reused by the router
 * before the i18n instance exists.
 */

export const SUPPORTED_LANGS = ["zh", "en"] as const;

export type SiteLang = (typeof SUPPORTED_LANGS)[number];

/** Default language; fallback for unsupported URL segments. */
export const DEFAULT_LANG: SiteLang = "en";

export const LANG_LABELS: Readonly<Record<SiteLang, string>> = {
  zh: "中文",
  en: "EN",
};

const LOCALE_STORAGE_KEY = "ai-media-site.lang.v1";

export function isSupportedLang(value: unknown): value is SiteLang {
  return value === "zh" || value === "en";
}

export function readStoredLang(): SiteLang | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const value = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isSupportedLang(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function storeLang(lang: SiteLang): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, lang);
  } catch {
    // Storage may be unavailable (private mode/quota); the URL segment still
    // carries the language for the current session.
  }
}

/**
 * Map browser languages to a site language: a Chinese primary language
 * resolves to `zh`; every other primary language resolves to `en`.
 */
export function detectBrowserLang(languages: readonly string[]): SiteLang {
  const primary = languages[0]?.toLowerCase() ?? "";
  return primary.startsWith("zh") ? "zh" : "en";
}

/**
 * Initial locale for the root redirect and i18n boot: stored choice >
 * browser language > default.
 */
export function detectInitialLang(): SiteLang {
  const stored = readStoredLang();
  if (stored) return stored;
  if (typeof window !== "undefined" && typeof navigator !== "undefined") {
    return detectBrowserLang(navigator.languages ?? []);
  }
  return DEFAULT_LANG;
}
