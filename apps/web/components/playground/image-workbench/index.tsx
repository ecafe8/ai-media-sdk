"use client";

import { LoaderCircle, Sparkles, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@workspace/ui/components/shadcn/button";

import { PLAYGROUND_PROVIDERS } from "@/lib/playground/registry";
import type {
  PlaygroundModel,
  PlaygroundProvider,
  PlaygroundResponse,
} from "@/lib/playground/types";
import { isValidHttpUrl } from "../lib/http";
import {
  imageAdvancedFieldSet,
  imageNOptions,
  imageSizeOptions,
  type ImageAdvancedFieldId,
} from "../lib/image-form-schema";
import { Field } from "../lib/field";
import { ResultFeed } from "../result-feed";

const PROMPTS = ["竖版的王国保卫战游戏界面", "一张可爱的人像摄影"];

interface ImageWorkbenchProps {
  readonly models: readonly PlaygroundModel[];
}

/**
 * Image-modality workbench.
 *
 * Owns its own form state (provider, model, operation, prompt, size/n
 * defaults, advanced options). When the user switches models, the size/n
 * dropdowns are re-derived from the new model's metadata and reset to the
 * first option. Mounts the ResultFeed in the right pane.
 */
export function ImageWorkbench({ models }: ImageWorkbenchProps) {
  const imageModels = useMemo(
    () => models.filter((m) => m.modality === "image" && (m.supportsGenerate || m.supportsEdit)),
    [models]
  );
  const configuredModels = imageModels.filter((m) => m.configured);
  const firstModel = configuredModels[0] ?? imageModels[0];

  const [provider, setProvider] = useState<PlaygroundProvider>(
    firstModel?.provider ?? "azure-openai"
  );
  const [modelId, setModelId] = useState(firstModel?.id ?? "gpt-image-2");
  const [operation, setOperation] = useState<"generate" | "edit">("generate");
  const [prompt, setPrompt] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedValues, setAdvancedValues] = useState<
    Partial<Record<ImageAdvancedFieldId, string | number | boolean>>
  >({});
  const [result, setResult] = useState<PlaygroundResponse>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState("");

  const providerModels = useMemo(
    () => imageModels.filter((m) => m.provider === provider),
    [imageModels, provider]
  );
  const currentModel = useMemo(
    () => imageModels.find((m) => m.provider === provider && m.id === modelId),
    [imageModels, provider, modelId]
  );

  // Size/n dropdowns are derived from the selected model's metadata.
  const sizeOptions = currentModel ? imageSizeOptions(currentModel) : [];
  const nOptions = currentModel ? imageNOptions(currentModel) : [];

  // Re-seed size/n defaults when the model changes. Using the React-
  // endorsed "adjust state during render" pattern (rather than useEffect)
  // to avoid a cascading render. We store the previously-seen model id and
  // only re-seed when the model has actually changed.
  const [size, setSize] = useState(sizeOptions[0]?.value ?? "1024x1024");
  const [n, setN] = useState(nOptions[0]?.value ?? 1);
  const [prevModelKey, setPrevModelKey] = useState(`${provider}:${modelId}`);
  const modelKey = `${provider}:${modelId}`;
  if (modelKey !== prevModelKey) {
    setPrevModelKey(modelKey);
    if (!sizeOptions.some((o) => o.value === size)) {
      setSize(sizeOptions[0]?.value ?? "1024x1024");
    }
    if (!nOptions.some((o) => o.value === n)) {
      setN(nOptions[0]?.value ?? 1);
    }
  }

  const canEdit = currentModel?.supportsEdit ?? false;
  const advancedFields = currentModel ? imageAdvancedFieldSet(currentModel) : [];

  function changeProvider(nextProvider: PlaygroundProvider) {
    const nextModels = imageModels.filter((m) => m.provider === nextProvider);
    setProvider(nextProvider);
    const next = nextModels[0];
    setModelId(next?.id ?? "");
    setReferenceImageUrl("");
  }

  function changeModel(nextModelId: string) {
    setModelId(nextModelId);
    setReferenceImageUrl("");
  }

  function reset() {
    setOperation("generate");
    setPrompt("");
    setReferenceImageUrl("");
    setAdvancedValues({});
    setAdvancedOpen(false);
    setResult(undefined);
    setValidationError("");
  }

  async function submit() {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setValidationError("请输入提示词后再开始生成。");
      return;
    }
    if (operation === "edit" && !isValidHttpUrl(referenceImageUrl)) {
      setValidationError("编辑模式需要一个有效的图片 URL。");
      return;
    }

    setValidationError("");
    setIsSubmitting(true);
    setResult({ status: "processing" });
    try {
      const body: Record<string, unknown> = {
        provider,
        model: modelId,
        modality: "image",
        imageOperation: operation,
        prompt: trimmedPrompt,
      };
      if (operation === "edit") {
        body.referenceImageUrl = referenceImageUrl;
      } else {
        body.size = size;
        body.n = n;
      }
      // Advanced options: only forward fields the user touched and that
      // belong to the current model's family. Empty objects are dropped.
      const ns = advancedNamespace(currentModel?.family);
      if (ns) {
        const picked = pickAdvancedValues(advancedFields, advancedValues);
        if (Object.keys(picked).length > 0) {
          body.providerOptions = { [ns]: picked };
        }
      }
      const response = await fetch("/api/playground/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as PlaygroundResponse;
      setResult(payload);
    } catch {
      setResult({
        status: "failed",
        error: {
          code: "NETWORK_ERROR",
          message: "服务端暂时不可用，请稍后重试。",
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-[1440px] gap-5 p-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:p-6">
      <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-4">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
            <WandSparkles className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold">图像工作台</h2>
            <p className="text-xs text-slate-500">文生图 / 图生图</p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm">
            <button
              type="button"
              aria-pressed={operation === "generate"}
              className={`rounded-md px-3 py-2 transition ${operation === "generate" ? "bg-white font-medium shadow-sm" : "text-slate-500"}`}
              onClick={() => setOperation("generate")}
            >
              文生图
            </button>
            <button
              type="button"
              aria-pressed={operation === "edit"}
              disabled={!canEdit}
              className={`rounded-md px-3 py-2 transition ${operation === "edit" ? "bg-white font-medium shadow-sm" : "text-slate-500"} disabled:cursor-not-allowed disabled:opacity-40`}
              onClick={() => setOperation("edit")}
            >
              图生图
            </button>
          </div>

          <Field label="Provider">
            <select
              value={provider}
              aria-label="Provider"
              className={selectClassName}
              onChange={(event) =>
                changeProvider(event.target.value as PlaygroundProvider)
              }
            >
              {PLAYGROUND_PROVIDERS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="模型">
            <select
              value={modelId}
              aria-label="模型"
              className={selectClassName}
              onChange={(event) => changeModel(event.target.value)}
            >
              {providerModels.map((item) => {
                const usable = item.supportsGenerate || item.supportsEdit;
                return (
                  <option key={item.id} value={item.id} disabled={!usable}>
                    {usable ? item.label : `${item.label}（暂不支持）`}
                  </option>
                );
              })}
            </select>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {currentModel?.recommendation ?? "该 Provider 尚未配置"}
            </p>
          </Field>

          {operation === "edit" && canEdit ? (
            <Field label="参考图 URL" required>
              <input
                type="url"
                value={referenceImageUrl}
                placeholder="https://..."
                aria-describedby="reference-hint"
                className={inputClassName}
                onChange={(event) => setReferenceImageUrl(event.target.value)}
              />
              <p id="reference-hint" className="mt-2 text-xs text-slate-500">
                支持 1-{currentModel?.maxEditImages ?? 1} 张图片，首期使用公开
                URL。
              </p>
            </Field>
          ) : null}

          <Field label="提示词" required>
            <textarea
              value={prompt}
              rows={5}
              placeholder="描述你想生成的画面..."
              aria-describedby="prompt-error"
              className="min-h-32 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => setPrompt(event.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {PROMPTS.map((item) => (
                <button
                  type="button"
                  key={item}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
                  onClick={() => setPrompt(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </Field>

          {operation === "generate" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="清晰度">
                <select
                  value={size}
                  aria-label="清晰度"
                  className={selectClassName}
                  onChange={(event) => setSize(event.target.value)}
                >
                  {sizeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="生成数量">
                <select
                  value={String(n)}
                  aria-label="生成数量"
                  className={selectClassName}
                  onChange={(event) => setN(Number(event.target.value))}
                >
                  {nOptions.map((opt) => (
                    <option key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}

          {advancedFields.length > 0 ? (
            <details
              open={advancedOpen}
              onToggle={(e) => setAdvancedOpen((e.currentTarget as HTMLDetailsElement).open)}
              className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2"
            >
              <summary className="cursor-pointer text-sm font-medium text-slate-700">
                高级选项
              </summary>
              <div className="mt-3 grid gap-3">
                {advancedFields.map((field) => (
                  <AdvancedFieldControl
                    key={field.id}
                    field={field}
                    value={advancedValues[field.id]}
                    onChange={(value) =>
                      setAdvancedValues((prev) => ({ ...prev, [field.id]: value }))
                    }
                  />
                ))}
              </div>
            </details>
          ) : null}

          {validationError ? (
            <p
              id="prompt-error"
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {validationError}
            </p>
          ) : null}

          <div className="flex gap-2 border-t border-slate-100 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={reset}
            >
              重置
            </Button>
            <Button
              type="button"
              className="flex-[2] bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={isSubmitting || !currentModel?.configured}
              onClick={submit}
            >
              {isSubmitting ? (
                <LoaderCircle className="mr-2 size-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 size-4" />
              )}
              {isSubmitting ? "生成中" : "开始生成"}
            </Button>
          </div>
          {!currentModel?.configured ? (
            <p className="text-xs leading-5 text-amber-700">
              当前 Provider 未配置。请先按 README 中的 `.env.example`
              配置服务端环境变量。
            </p>
          ) : null}
        </div>
      </aside>

      <section
        aria-live="polite"
        className="min-h-[640px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-7"
      >
        <div className="mb-6 flex items-end justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-slate-400 uppercase">
              Result feed
            </p>
            <h2 className="mt-1 text-lg font-semibold">生成结果</h2>
          </div>
          <span className="text-xs text-slate-400">结果仅作临时预览</span>
        </div>
        <ResultFeed
          result={result}
          prompt={prompt}
          provider={provider}
          model={modelId}
          configured={configuredModels.length > 0}
        />
      </section>
    </div>
  );
}

function AdvancedFieldControl({
  field,
  value,
  onChange,
}: {
  field: ReturnType<typeof imageAdvancedFieldSet>[number];
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean) => void;
}) {
  if (field.kind === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={typeof value === "boolean" ? value : false}
          className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-200"
          onChange={(event) => onChange(event.target.checked)}
        />
        {field.label}
      </label>
    );
  }
  if (field.kind === "select") {
    return (
      <Field label={field.label}>
        <select
          value={typeof value === "string" ? value : ""}
          className={selectClassName}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">未指定</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </Field>
    );
  }
  if (field.kind === "number") {
    return (
      <Field label={field.label}>
        <input
          type="number"
          value={typeof value === "number" ? String(value) : ""}
          className={inputClassName}
          onChange={(event) =>
            onChange(event.target.value === "" ? "" : Number(event.target.value))
          }
        />
      </Field>
    );
  }
  return (
    <Field label={field.label}>
      <input
        type="text"
        value={typeof value === "string" ? value : ""}
        className={inputClassName}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

const selectClassName =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

const inputClassName =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

/**
 * Map a Playground family slug to its `providerOptions.<namespace>` key.
 * Returns `undefined` for families without a namespace (defensive; all
 * image families declare one).
 */
function advancedNamespace(
  family: PlaygroundModel["family"] | undefined
): "azure" | "aliyun" | "seedream" | undefined {
  if (!family) return undefined;
  if (family === "azure-gpt-image") return "azure";
  if (family === "qwen-multimodal" || family === "wan-image") return "aliyun";
  if (family.startsWith("doubao-seedream")) return "seedream";
  return undefined;
}

/**
 * Project the per-family advanced-values map into the wire-shape object
 * expected by `providerOptions.<namespace>`. Field ids are translated from
 * the `family.field` form (e.g. `azure.quality`) back to the API field name
 * (e.g. `quality`).
 */
function pickAdvancedValues(
  fields: ReturnType<typeof imageAdvancedFieldSet>,
  values: Partial<Record<ImageAdvancedFieldId, string | number | boolean>>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.id];
    if (value === undefined || value === "" || value === false) continue;
    const dotIndex = field.id.indexOf(".");
    const apiFieldName = field.id.slice(dotIndex + 1);
    out[apiFieldName] = value;
  }
  return out;
}
