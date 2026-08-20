import { useTranslation } from "react-i18next";

import { Playground } from "@/components/playground";
import { usePageMetadata } from "@/lib/docs/page-metadata";
import { SITE_MODELS } from "@/lib/playground/registry";

export function PlaygroundPage() {
  const { t } = useTranslation();

  usePageMetadata({
    title: t("playground.title"),
    description: t("playground.footerNote"),
  });

  return <Playground models={SITE_MODELS} />;
}
