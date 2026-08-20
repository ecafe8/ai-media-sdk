import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/shadcn/collapsible";
import { ScrollArea } from "@workspace/ui/components/shadcn/scroll-area";
import { cn } from "@workspace/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { buildNav } from "@/lib/docs/navigation";
import { buildDocPath } from "@/lib/docs/paths";
import type { SiteLang } from "@/lib/locale";

/**
 * Docs sidebar: manifest groups with collapsible sections. Desktop renders
 * it in a sticky aside; mobile reuses it inside a Sheet (see docs-layout).
 * Titles come from frontmatter via buildNav — never from the manifest.
 */
export function DocsSidebar({
  lang,
  currentSlug,
  onNavigate,
}: {
  lang: SiteLang;
  currentSlug?: string;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const groups = buildNav(lang);

  return (
    <nav aria-label={t("docs.navAria")}>
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-5 pr-3 pb-6">
          {groups.map((group) => (
            <Collapsible key={group.id} defaultOpen>
              <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md px-2 py-1 font-medium text-muted-foreground text-xs uppercase tracking-wider transition hover:text-foreground">
                {t(`docs.groups.${group.id}`)}
                <ChevronDown
                  className="size-3.5 transition-transform group-data-[panel-open]:rotate-180"
                  aria-hidden
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="mt-1.5 flex flex-col gap-0.5 border-border border-l pl-3">
                  {group.items.map((item) => {
                    const active = item.slug === currentSlug;
                    return (
                      <li key={item.slug}>
                        <Link
                          to={buildDocPath(lang, item.slug)}
                          onClick={onNavigate}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "block rounded-md px-2 py-1 text-sm transition",
                            active
                              ? "bg-muted font-medium text-foreground"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          )}
                        >
                          {item.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>
    </nav>
  );
}
