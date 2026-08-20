import { Button } from "@workspace/ui/components/shadcn/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/shadcn/sheet";
import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { DocsToc } from "@/components/docs/docs-toc";
import { PageContainer } from "@/components/layout/page-container";
import type { SiteLang } from "@/lib/locale";

import "@/styles/docs.css";

/**
 * Docs area shell: sidebar (desktop sticky aside / mobile Sheet), article
 * column, and right-hand TOC. Note: shadcn `Sidebar` is app-shell-oriented
 * (fixed viewport positioning), so per design D6 the nav is composed from
 * ScrollArea + Collapsible + Button instead.
 */
export function DocsLayout({
  lang,
  slug,
  children,
}: {
  lang: SiteLang;
  slug?: string;
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <main className="min-h-svh bg-background text-foreground">
      <PageContainer>
        <div className="flex items-center gap-2 border-border border-b py-2.5 lg:hidden">
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("docs.navToggle")}
                />
              }
            >
              <Menu aria-hidden />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 sm:max-w-72">
              <SheetTitle className="sr-only">{t("docs.navAria")}</SheetTitle>
              <div className="h-full overflow-hidden p-4 pt-14">
                <DocsSidebar
                  lang={lang}
                  currentSlug={slug}
                  onNavigate={() => setNavOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>
          <span className="font-medium text-sm">{t("docs.breadcrumb")}</span>
        </div>
        <div className="flex gap-10 py-8">
          <aside className="hidden w-56 shrink-0 lg:block">
            <div className="sticky top-8 max-h-[calc(100svh-4rem)]">
              <DocsSidebar lang={lang} currentSlug={slug} />
            </div>
          </aside>
          <div className="min-w-0 flex-1">{children}</div>
          {slug ? (
            <aside className="hidden w-44 shrink-0 xl:block">
              <div className="sticky top-8">
                <DocsToc key={`${lang}:${slug}`} />
              </div>
            </aside>
          ) : null}
        </div>
      </PageContainer>
    </main>
  );
}
