import { ThemeSwitcher } from "@workspace/ui/components/custom/theme-switcher";
import { useTranslation } from "react-i18next";
import { FaGithub } from "react-icons/fa";
import { Link } from "react-router-dom";

import { LanguageSwitcher } from "@/components/language-switcher";
import { PageContainer } from "@/components/layout/page-container";
import type { SiteLang } from "@/lib/locale";

const REPO_URL = "https://github.com/ecafe8/ai-media-sdk";

/** Site-wide navigation shared by the landing page and full-screen work areas. */
export function SiteHeader({
  lang,
  wide = false,
}: {
  readonly lang: SiteLang;
  readonly wide?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <header className="border-border border-b bg-card py-3">
      <PageContainer
        wide={wide}
        className="flex min-h-10 items-center justify-between gap-4"
      >
        <Link
          to={`/${lang}`}
          className="shrink-0 font-semibold text-emerald-600 text-xs uppercase tracking-[0.24em]"
        >
          {t("common.appName")}
        </Link>
        <nav
          aria-label={t("siteNav.aria")}
          className="hidden items-center gap-1 sm:flex"
        >
          <Link
            to={`/${lang}/docs`}
            className="rounded-lg px-3 py-2 font-medium text-muted-foreground text-sm transition hover:bg-muted hover:text-foreground"
          >
            {t("landing.navDocs")}
          </Link>
          <Link
            to={`/${lang}/playground`}
            className="rounded-lg px-3 py-2 font-medium text-muted-foreground text-sm transition hover:bg-muted hover:text-foreground"
          >
            {t("landing.enterPlayground")}
          </Link>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <LanguageSwitcher />
          <ThemeSwitcher
            ariaLabel={t("theme.aria")}
            labels={{
              light: t("theme.light"),
              system: t("theme.system"),
              dark: t("theme.dark"),
            }}
          />
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label={t("common.github")}
            title={t("common.github")}
            className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:text-foreground"
          >
            <FaGithub className="size-4" />
          </a>
        </div>
      </PageContainer>
    </header>
  );
}
