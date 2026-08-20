import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/shadcn/table";
import { useTranslation } from "react-i18next";

import { CapabilityBadges } from "@/components/docs/capability-badges";
import { useDocsLang } from "@/components/docs/mdx-components";
import type { DocModel } from "@/lib/docs/model-projection";
import { projectProviderModels } from "@/lib/docs/model-projection";
import type { SiteProvider } from "@/lib/key-store";

/**
 * Data-driven model table for provider docs. Rows come from the provider
 * registries (via the docs projection), so registry changes flow into docs
 * without editing content. Conditional columns render provider-specific
 * fields (video resolutions/ratios, reference media caps) only when any
 * model of the provider declares them.
 */

function sizeText(model: DocModel): string {
  const parts: string[] = [];
  if (model.supportedSizes && model.supportedSizes.length > 0) {
    parts.push(model.supportedSizes.join(" / "));
  }
  if (model.maxResolution) {
    parts.push(`≤ ${model.maxResolution.width}x${model.maxResolution.height}`);
  }
  return parts.join(" · ");
}

function referenceMediaText(model: DocModel): string {
  const parts: string[] = [];
  if (model.maxReferenceImages !== undefined) {
    parts.push(`img ≤${model.maxReferenceImages}`);
  }
  if (model.maxReferenceVideos !== undefined) {
    parts.push(`video ≤${model.maxReferenceVideos}`);
  }
  if (model.maxReferenceAudios !== undefined) {
    parts.push(`audio ≤${model.maxReferenceAudios}`);
  }
  return parts.join(", ");
}

export function ProviderModelTable({ provider }: { provider: SiteProvider }) {
  const { t } = useTranslation();
  const lang = useDocsLang();
  const models = projectProviderModels(lang, provider);
  const empty = t("docs.modelTable.empty");

  const hasResolution = models.some((m) => m.supportedResolutions);
  const hasRatio = models.some((m) => m.supportedAspectRatios);
  const hasReferenceMedia = models.some(
    (m) =>
      m.maxReferenceImages !== undefined ||
      m.maxReferenceVideos !== undefined ||
      m.maxReferenceAudios !== undefined
  );

  return (
    <div className="my-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("docs.modelTable.model")}</TableHead>
            <TableHead>{t("docs.modelTable.capabilities")}</TableHead>
            <TableHead>{t("docs.modelTable.size")}</TableHead>
            <TableHead>{t("docs.modelTable.maxN")}</TableHead>
            <TableHead>{t("docs.modelTable.maxEditImages")}</TableHead>
            {hasResolution ? (
              <TableHead>{t("docs.modelTable.resolution")}</TableHead>
            ) : null}
            {hasRatio ? (
              <TableHead>{t("docs.modelTable.ratio")}</TableHead>
            ) : null}
            {hasReferenceMedia ? (
              <TableHead>{t("docs.modelTable.referenceMedia")}</TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {models.map((model) => (
            <TableRow key={model.id}>
              <TableCell>
                <span className="block font-medium text-foreground text-sm">
                  {model.label}
                </span>
                <span className="block font-mono text-muted-foreground/70 text-xs">
                  {model.id}
                </span>
              </TableCell>
              <TableCell>
                <CapabilityBadges model={model} />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {sizeText(model) || empty}
              </TableCell>
              <TableCell>{model.maxN ?? empty}</TableCell>
              <TableCell>{model.maxEditImages ?? empty}</TableCell>
              {hasResolution ? (
                <TableCell className="whitespace-nowrap">
                  {model.supportedResolutions?.join(" / ") ?? empty}
                </TableCell>
              ) : null}
              {hasRatio ? (
                <TableCell>
                  {model.supportedAspectRatios?.join(" / ") ?? empty}
                </TableCell>
              ) : null}
              {hasReferenceMedia ? (
                <TableCell className="whitespace-nowrap">
                  {referenceMediaText(model) || empty}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
