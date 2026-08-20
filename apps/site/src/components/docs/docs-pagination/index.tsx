import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { getAdjacentDocs } from "@/lib/docs/navigation";
import { buildDocPath } from "@/lib/docs/paths";
import type { SiteLang } from "@/lib/locale";

/**
 * Prev/next navigation at the bottom of a doc, derived from the flattened
 * manifest order (draft/untranslated pages are skipped automatically).
 */
export function DocsPagination({
  lang,
  slug,
}: {
  lang: SiteLang;
  slug: string;
}) {
  const { t } = useTranslation();
  const { prev, next } = getAdjacentDocs(lang, slug);

  if (!prev && !next) return null;

  return (
    <nav
      aria-label={`${t("docs.prev")} / ${t("docs.next")}`}
      className="mt-10 grid gap-3 border-border border-t pt-6 sm:grid-cols-2"
    >
      {prev ? (
        <Link
          to={buildDocPath(lang, prev.slug)}
          className="rounded-xl border border-border bg-card px-4 py-3 transition hover:border-foreground/20"
        >
          <span className="text-muted-foreground text-xs">
            {t("docs.prev")}
          </span>
          <span className="mt-0.5 block font-medium text-foreground text-sm">
            {prev.title}
          </span>
        </Link>
      ) : (
        <div aria-hidden />
      )}
      {next ? (
        <Link
          to={buildDocPath(lang, next.slug)}
          className="rounded-xl border border-border bg-card px-4 py-3 text-right transition hover:border-foreground/20"
        >
          <span className="text-muted-foreground text-xs">
            {t("docs.next")}
          </span>
          <span className="mt-0.5 block font-medium text-foreground text-sm">
            {next.title}
          </span>
        </Link>
      ) : (
        <div aria-hidden />
      )}
    </nav>
  );
}
