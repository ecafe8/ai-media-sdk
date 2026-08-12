import { useTranslation } from "react-i18next";

import type { SiteProvider } from "@/lib/key-store";
import type {
  SiteModality,
  SitePlaygroundResponse,
} from "@/lib/playground/types";
import { ResultFeed } from "../result-feed";
import { ResultStoragePanel } from "../result-storage-panel";

/**
 * Right-hand result section. The storage-settings panel (automatic local
 * saving of generated results) is pinned above the result feed; the left
 * workbench keeps generation parameters only.
 */

export interface ResultPanelProps {
  readonly result: SitePlaygroundResponse | undefined;
  readonly prompt: string;
  readonly provider: SiteProvider;
  readonly model: string;
  readonly configured: boolean;
  readonly modality: SiteModality;
}

export function ResultPanel({
  result,
  prompt,
  provider,
  model,
  configured,
}: ResultPanelProps) {
  const { t } = useTranslation();
  return (
    <section
      aria-live="polite"
      className="min-h-[640px] rounded-2xl border border-border bg-card p-5 shadow-sm lg:p-7"
    >
      <div className="mb-6 flex items-end justify-between border-border/60 border-b pb-4">
        <div>
          <p className="font-semibold text-muted-foreground/70 text-xs uppercase tracking-[0.2em]">
            {t("playground.result.eyebrow")}
          </p>
          <h2 className="mt-1 font-semibold text-lg">
            {t("playground.result.title")}
          </h2>
        </div>
        <span className="text-muted-foreground/70 text-xs">
          {t("playground.result.temporaryNote")}
        </span>
      </div>

      <div className="mb-5">
        <ResultStoragePanel result={result} />
      </div>

      <ResultFeed
        result={result}
        prompt={prompt}
        provider={provider}
        model={model}
        configured={configured}
      />
    </section>
  );
}
