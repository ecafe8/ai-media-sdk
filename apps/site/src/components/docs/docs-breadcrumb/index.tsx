import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/shadcn/breadcrumb";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { DOC_GROUPS } from "@/content/docs/manifest";
import { buildDocPath } from "@/lib/docs/paths";
import type { SiteLang } from "@/lib/locale";

/**
 * Docs breadcrumb: Docs home → group → current page title. Group labels
 * resolve via i18n; the page title comes from frontmatter.
 */
export function DocsBreadcrumb({
  lang,
  slug,
  title,
}: {
  lang: SiteLang;
  slug: string;
  title: string;
}) {
  const { t } = useTranslation();
  const group = DOC_GROUPS.find((candidate) => candidate.slugs.includes(slug));

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link to={buildDocPath(lang)} />}>
            {t("docs.breadcrumb")}
          </BreadcrumbLink>
        </BreadcrumbItem>
        {group ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="text-muted-foreground">
              {t(`docs.groups.${group.id}`)}
            </BreadcrumbItem>
          </>
        ) : null}
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
