import { Badge } from "@workspace/ui/components/shadcn/badge";
import { useTranslation } from "react-i18next";

import type { DocModel } from "@/lib/docs/model-projection";

/**
 * Capability badges for a doc model, semantically aligned with the landing
 * page matrix (generate/edit/video/async).
 */
export function CapabilityBadges({ model }: { model: DocModel }) {
  const { t } = useTranslation();
  const badges: readonly { key: string; label: string }[] = [
    ...(model.generate
      ? [{ key: "generate", label: t("landing.capability.generate") }]
      : []),
    ...(model.edit
      ? [{ key: "edit", label: t("landing.capability.edit") }]
      : []),
    ...(model.modality === "video"
      ? [{ key: "video", label: t("landing.capability.video") }]
      : []),
    ...(model.async
      ? [{ key: "async", label: t("landing.capability.async") }]
      : []),
  ];

  return (
    <span className="flex flex-wrap gap-1">
      {badges.map((badge) => (
        <Badge key={badge.key} variant="outline" className="text-xs">
          {badge.label}
        </Badge>
      ))}
    </span>
  );
}
