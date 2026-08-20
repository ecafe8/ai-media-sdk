import type { SiteLang } from "@/lib/locale";

/**
 * Language-aware docs paths. MDX content authors write language-neutral
 * links (`/docs/<slug>`); DocLink rewrites them with the active language
 * segment so rendered hrefs always carry `/:lang`.
 */
export function buildDocPath(lang: SiteLang, slug?: string): string {
  const base = `/${lang}/docs`;
  return slug ? `${base}/${slug}` : base;
}
