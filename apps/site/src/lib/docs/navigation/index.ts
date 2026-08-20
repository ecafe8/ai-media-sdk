import { DOC_GROUPS, type DocGroupId } from "@/content/docs/manifest";
import { getDoc } from "@/lib/docs/content-loader";
import type { SiteLang } from "@/lib/locale";

/**
 * Docs navigation derived from the manifest plus loaded frontmatter. A doc
 * appears only when its file exists for the language and is not a draft, so
 * untranslated (missing en file) and in-progress pages stay out of the
 * sidebar and prev/next chains. Titles come from frontmatter only.
 */

export interface NavDoc {
  readonly slug: string;
  readonly title: string;
}

export interface NavGroup {
  readonly id: DocGroupId;
  readonly items: readonly NavDoc[];
}

export function buildNav(lang: SiteLang): readonly NavGroup[] {
  return DOC_GROUPS.map((group) => ({
    id: group.id,
    items: group.slugs.flatMap((slug): readonly NavDoc[] => {
      const doc = getDoc(lang, slug);
      if (!doc || doc.frontmatter.draft === true) return [];
      return [{ slug, title: doc.frontmatter.title }];
    }),
  })).filter((group) => group.items.length > 0);
}

export function flattenNav(lang: SiteLang): readonly NavDoc[] {
  return buildNav(lang).flatMap((group) => [...group.items]);
}

export function firstNavSlug(lang: SiteLang): string | undefined {
  return flattenNav(lang)[0]?.slug;
}

export interface AdjacentDocs {
  readonly prev?: NavDoc;
  readonly next?: NavDoc;
}

export function getAdjacentDocs(lang: SiteLang, slug: string): AdjacentDocs {
  const flat = flattenNav(lang);
  const index = flat.findIndex((doc) => doc.slug === slug);
  if (index === -1) return {};
  return {
    prev: index > 0 ? flat[index - 1] : undefined,
    next: index < flat.length - 1 ? flat[index + 1] : undefined,
  };
}
