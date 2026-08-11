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
  readonly provider: string;
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
  return (
    <section
      aria-live="polite"
      className="min-h-[640px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-7"
    >
      <div className="mb-6 flex items-end justify-between border-slate-100 border-b pb-4">
        <div>
          <p className="font-semibold text-slate-400 text-xs uppercase tracking-[0.2em]">
            Result feed
          </p>
          <h2 className="mt-1 font-semibold text-lg">生成结果</h2>
        </div>
        <span className="text-slate-400 text-xs">结果仅作临时预览</span>
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
