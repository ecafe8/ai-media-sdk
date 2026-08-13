import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router-dom";

import { LANG_LABELS, type SiteLang, SUPPORTED_LANGS } from "@/lib/locale";

/**
 * Locale switcher for the site headers. Switching navigates to the same
 * page under the other language prefix, so playground form/result state
 * (same route branch) is preserved.
 */
export function LanguageSwitcher() {
  const { t } = useTranslation();
  const params = useParams();
  const location = useLocation();

  function targetFor(target: SiteLang): string {
    const rest = location.pathname.replace(/^\/[^/]+/, "");
    return `/${target}${rest}`;
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: A fieldset is wrong semantics for navigation links; role="group" keeps the switcher labeled without form connotations
    <div
      role="group"
      aria-label={t("langSwitcher.aria")}
      className="flex h-9 items-center gap-0.5 rounded-full border border-border bg-muted p-0.5"
    >
      {SUPPORTED_LANGS.map((item) =>
        item === params.lang ? (
          <span
            key={item}
            aria-current="true"
            className="flex h-7 items-center rounded-full bg-card px-2.5 font-medium text-foreground text-xs shadow-sm"
          >
            {LANG_LABELS[item]}
          </span>
        ) : (
          <Link
            key={item}
            to={targetFor(item)}
            className="flex h-7 items-center rounded-full px-2.5 text-muted-foreground text-xs transition hover:text-foreground"
          >
            {LANG_LABELS[item]}
          </Link>
        )
      )}
    </div>
  );
}
