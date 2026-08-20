import type { ComponentType } from "react";
import { z } from "zod";

import { DOC_GROUPS } from "@/content/docs/manifest";
import type { MdxComponents } from "@/lib/docs/mdx-types";
import type { SiteLang } from "@/lib/locale";

/**
 * Docs content loading: eager-collects the per-language MDX modules,
 * derives slugs from file paths, and validates frontmatter with zod at
 * module init so invalid docs fail the build/tests instead of rendering.
 */

export const docFrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  draft: z.boolean().optional(),
});

export type DocFrontmatter = z.infer<typeof docFrontmatterSchema>;

export interface LoadedDoc {
  readonly lang: SiteLang;
  readonly slug: string;
  readonly frontmatter: DocFrontmatter;
  readonly Content: ComponentType<{ components?: MdxComponents }>;
}

interface RawDocModule {
  default: ComponentType<{ components?: MdxComponents }>;
  frontmatter?: unknown;
}

const zhModules = import.meta.glob("../../../content/docs/zh/**/*.mdx", {
  eager: true,
});
const enModules = import.meta.glob("../../../content/docs/en/**/*.mdx", {
  eager: true,
});

const MODULES_BY_LANG: Record<SiteLang, Record<string, unknown>> = {
  zh: zhModules,
  en: enModules,
};

function slugFromPath(path: string, lang: SiteLang): string {
  const prefix = `../../../content/docs/${lang}/`;
  const relative = path.startsWith(prefix) ? path.slice(prefix.length) : path;
  return relative.replace(/\.mdx?$/, "");
}

function parseFrontmatter(path: string, raw: unknown): DocFrontmatter {
  const parsed = docFrontmatterSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid doc frontmatter in ${path}: ${issues}`);
  }
  return parsed.data;
}

function loadLang(lang: SiteLang): ReadonlyMap<string, LoadedDoc> {
  const docs = new Map<string, LoadedDoc>();
  for (const [path, mod] of Object.entries(MODULES_BY_LANG[lang])) {
    const raw = mod as RawDocModule;
    const slug = slugFromPath(path, lang);
    docs.set(slug, {
      lang,
      slug,
      frontmatter: parseFrontmatter(path, raw.frontmatter),
      Content: raw.default,
    });
  }
  return docs;
}

const DOCS_BY_LANG: Record<SiteLang, ReadonlyMap<string, LoadedDoc>> = {
  zh: loadLang("zh"),
  en: loadLang("en"),
};

export function getDoc(lang: SiteLang, slug: string): LoadedDoc | undefined {
  return DOCS_BY_LANG[lang].get(slug);
}

export function docExists(lang: SiteLang, slug: string): boolean {
  return DOCS_BY_LANG[lang].has(slug);
}

/** Loaded slugs for a language, sorted; test/consistency checks use this. */
export function listDocSlugs(lang: SiteLang): readonly string[] {
  return [...DOCS_BY_LANG[lang].keys()].sort();
}

/** Slugs declared in the manifest, in navigation order. */
export function listManifestSlugs(): readonly string[] {
  return DOC_GROUPS.flatMap((group) => [...group.slugs]);
}
