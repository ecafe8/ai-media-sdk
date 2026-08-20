import { ScrollArea } from "@workspace/ui/components/shadcn/scroll-area";
import { cn } from "@workspace/ui/lib/utils";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface TocItem {
  readonly id: string;
  readonly text: string;
  readonly level: 2 | 3;
}

/**
 * Right-hand table of contents: collects `h2[id]`/`h3[id]` anchors (added
 * by rehype-slug at build time) from the rendered article on mount. The
 * parent keys this component by `lang/slug`, so it remounts per doc and
 * re-collects without stale state.
 */
export function DocsToc() {
  const [items, setItems] = useState<readonly TocItem[]>([]);
  const { t } = useTranslation();

  useEffect(() => {
    const article = document.querySelector("article.docs-article");
    if (!article) return;
    const headings =
      article.querySelectorAll<HTMLHeadingElement>("h2[id], h3[id]");
    setItems(
      [...headings].map((el) => ({
        id: el.id,
        text: el.textContent ?? "",
        level: el.tagName === "H2" ? 2 : 3,
      }))
    );
  }, []);

  if (items.length === 0) return null;

  return (
    <nav aria-label={t("docs.toc")}>
      <p className="px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
        {t("docs.toc")}
      </p>
      <ScrollArea className="mt-2 max-h-[calc(100svh-10rem)]">
        <ul className="flex flex-col gap-1 border-border border-l pb-4">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById(item.id)
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className={cn(
                  "block w-full border-transparent border-l-2 py-0.5 pl-3 text-left text-muted-foreground text-xs leading-5 transition hover:border-foreground/30 hover:text-foreground",
                  item.level === 3 && "pl-6"
                )}
              >
                {item.text}
              </button>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </nav>
  );
}
