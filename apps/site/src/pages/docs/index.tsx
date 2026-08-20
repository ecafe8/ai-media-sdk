import { Button } from "@workspace/ui/components/shadcn/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/shadcn/card";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useParams } from "react-router-dom";

import { DocsBreadcrumb } from "@/components/docs/docs-breadcrumb";
import { DocsLayout } from "@/components/docs/docs-layout";
import { DocsPagination } from "@/components/docs/docs-pagination";
import {
  DocsLangProvider,
  MDX_COMPONENTS,
} from "@/components/docs/mdx-components";
import type { LoadedDoc } from "@/lib/docs/content-loader";
import {
  docExists,
  getDoc,
  listManifestSlugs,
} from "@/lib/docs/content-loader";
import { firstNavSlug } from "@/lib/docs/navigation";
import { usePageMetadata } from "@/lib/docs/page-metadata";
import { buildDocPath } from "@/lib/docs/paths";
import { DEFAULT_LANG, isSupportedLang, type SiteLang } from "@/lib/locale";

type DocsState =
  | { kind: "doc"; doc: LoadedDoc }
  | { kind: "draft"; doc: LoadedDoc }
  | { kind: "untranslated" }
  | { kind: "notFound" };

function resolveState(lang: SiteLang, slug: string): DocsState {
  const doc = getDoc(lang, slug);
  if (doc) {
    return doc.frontmatter.draft === true
      ? { kind: "draft", doc }
      : { kind: "doc", doc };
  }
  const inManifest = listManifestSlugs().includes(slug);
  if (inManifest && lang === "en" && docExists("zh", slug)) {
    return { kind: "untranslated" };
  }
  return { kind: "notFound" };
}

function useDocsLang(): SiteLang {
  const { lang } = useParams();
  return isSupportedLang(lang) ? lang : DEFAULT_LANG;
}

/** `/:lang/docs` index: redirect to the first available doc of the language. */
export function DocsIndexPage() {
  const lang = useDocsLang();
  const first = firstNavSlug(lang);
  return <Navigate to={buildDocPath(lang, first)} replace />;
}

/** Legacy language-less `/docs` paths: redirect to the visitor language. */
export function LegacyDocsRedirect() {
  const location = useLocation();
  const rest = location.pathname.replace(/^\/docs/, "");
  return <Navigate to={`/${DEFAULT_LANG}/docs${rest}`} replace />;
}

/** `/:lang/docs/*`: resolves the slug and renders doc/placeholder/404. */
export function DocsPage() {
  const lang = useDocsLang();
  const params = useParams();
  const slug = params["*"] ?? "";
  const location = useLocation();
  const { t } = useTranslation();
  const state = resolveState(lang, slug);

  const metadata = (() => {
    switch (state.kind) {
      case "doc":
        return {
          title: state.doc.frontmatter.title,
          description: state.doc.frontmatter.description,
        };
      case "draft":
        return {
          title: state.doc.frontmatter.title,
          description: t("docs.draft.description"),
        };
      case "untranslated":
        return {
          title: t("docs.untranslated.title"),
          description: t("docs.untranslated.description"),
        };
      case "notFound":
        return {
          title: t("docs.notFound.title"),
          description: t("docs.notFound.description"),
        };
    }
  })();
  usePageMetadata(metadata);

  return (
    <DocsLangProvider lang={lang}>
      <ScrollReset key={`${lang}:${slug}`} hash={location.hash} />
      <DocsLayout lang={lang} slug={state.kind === "doc" ? slug : undefined}>
        <DocsStateView state={state} lang={lang} slug={slug} />
      </DocsLayout>
    </DocsLangProvider>
  );
}

/**
 * Scroll behavior on doc change: the parent keys this by `lang/slug`, so a
 * new doc remounts it and scrolls to top (or to the hash target); hash
 * changes within a doc re-run via the `hash` dependency.
 */
function ScrollReset({ hash }: { hash: string }) {
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
      return;
    }
    window.scrollTo(0, 0);
  }, [hash]);
  return null;
}

function DocsStateView({
  state,
  lang,
  slug,
}: {
  state: DocsState;
  lang: SiteLang;
  slug: string;
}) {
  const { t } = useTranslation();

  if (state.kind === "doc") {
    const { doc } = state;
    return (
      <>
        <DocsBreadcrumb lang={lang} slug={slug} title={doc.frontmatter.title} />
        <article className="docs-article">
          <doc.Content components={MDX_COMPONENTS} />
        </article>
        <DocsPagination lang={lang} slug={slug} />
      </>
    );
  }

  if (state.kind === "draft") {
    return (
      <StateCard
        title={t("docs.draft.title")}
        description={t("docs.draft.description")}
      />
    );
  }

  if (state.kind === "untranslated") {
    return (
      <StateCard
        title={t("docs.untranslated.title")}
        description={t("docs.untranslated.description")}
      >
        <Button
          render={<a href={buildDocPath("zh", slug)} />}
          variant="outline"
        >
          {t("docs.untranslated.readZh")}
        </Button>
      </StateCard>
    );
  }

  return (
    <StateCard
      title={t("docs.notFound.title")}
      description={t("docs.notFound.description")}
    >
      <Button render={<a href={buildDocPath(lang)} />} variant="outline">
        {t("docs.notFound.back")}
      </Button>
    </StateCard>
  );
}

function StateCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <Card className="mx-auto mt-10 max-w-md">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}
