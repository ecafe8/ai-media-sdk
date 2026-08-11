"use client";

import { Button } from "@workspace/ui/components/shadcn/button";
import { Checkbox } from "@workspace/ui/components/shadcn/checkbox";
import { Input } from "@workspace/ui/components/shadcn/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/shadcn/select";
import { Textarea } from "@workspace/ui/components/shadcn/textarea";
import { LoaderCircle, Sparkles, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { PLAYGROUND_PROVIDERS } from "@/lib/playground/registry";
import type {
  PlaygroundCredentials,
  PlaygroundModel,
  PlaygroundProvider,
  PlaygroundResponse,
} from "@/lib/playground/types";
import { CredentialsPanel } from "../credentials-panel";
import {
  isCredentialsComplete,
  normalizeCredentials,
  type StoredCredentialsMap,
} from "../lib/credentials";
import { Field } from "../lib/field";
import { isValidHttpUrl } from "../lib/http";
import {
  type ImageAdvancedFieldId,
  imageAdvancedFieldSet,
  imageNOptions,
  imageSizeOptions,
} from "../lib/image-form-schema";
import { ResultFeed } from "../result-feed";

const PROMPTS = ["竖版的王国保卫战游戏界面", "一张可爱的人像摄影"];

interface ImageWorkbenchProps {
  readonly models: readonly PlaygroundModel[];
  readonly credentialsMap: StoredCredentialsMap;
  readonly serverConfiguredProviders: ReadonlySet<PlaygroundProvider>;
  readonly onCredentialsChange: (
    provider: PlaygroundProvider,
    credentials: PlaygroundCredentials
  ) => void;
  readonly onCredentialsClear: (provider: PlaygroundProvider) => void;
}

/**
 * Image-modality workbench.
 *
 * Owns its own form state (provider, model, operation, prompt, size/n
 * defaults, advanced options). When the user switches models, the size/n
 * dropdowns are re-derived from the new model's metadata and reset to the
 * first option. Mounts the ResultFeed in the right pane.
 */
export function ImageWorkbench({
  models,
  credentialsMap,
  serverConfiguredProviders,
  onCredentialsChange,
  onCredentialsClear,
}: ImageWorkbenchProps) {
  const imageModels = useMemo(
    () =>
      models.filter(
        (m) => m.modality === "image" && (m.supportsGenerate || m.supportsEdit)
      ),
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
  const advancedFields = currentModel
    ? imageAdvancedFieldSet(currentModel)
    : [];

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

    const byoCredentials = normalizeCredentials(credentialsMap[provider]);
    const serverConfigured = serverConfiguredProviders.has(provider);
    if (!serverConfigured && !isCredentialsComplete(provider, byoCredentials)) {
      setValidationError(
        "当前 Provider 未在服务端配置，请先填写完整的 API Key 凭证。"
      );
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
        ...(byoCredentials && isCredentialsComplete(provider, byoCredentials)
          ? { credentials: byoCredentials }
          : {}),
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
        <div className="mb-5 flex items-center gap-2 border-slate-100 border-b pb-4">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
            <WandSparkles className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold">图像工作台</h2>
            <p className="text-slate-500 text-xs">文生图 / 图生图</p>
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
            <Select
              value={provider}
              items={PLAYGROUND_PROVIDERS.map((item) => ({
                value: item.id,
                label: item.label,
              }))}
              onValueChange={(value) => {
                if (typeof value === "string") {
                  changeProvider(value as PlaygroundProvider);
                }
              }}
            >
              <SelectTrigger aria-label="Provider" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAYGROUND_PROVIDERS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <CredentialsPanel
            key={provider}
            provider={provider}
            providerLabel={
              PLAYGROUND_PROVIDERS.find((item) => item.id === provider)
                ?.label ?? provider
            }
            configured={serverConfiguredProviders.has(provider)}
            credentials={credentialsMap[provider]}
            onChange={(next) => onCredentialsChange(provider, next)}
            onClear={() => onCredentialsClear(provider)}
          />

          <Field label="模型">
            <Select
              value={modelId}
              items={providerModels.map((item) => {
                const usable = item.supportsGenerate || item.supportsEdit;
                return {
                  value: item.id,
                  label: usable ? item.label : `${item.label}（暂不支持）`,
                };
              })}
              onValueChange={(value) => {
                if (typeof value === "string") changeModel(value);
              }}
            >
              <SelectTrigger aria-label="模型" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providerModels.map((item) => {
                  const usable = item.supportsGenerate || item.supportsEdit;
                  return (
                    <SelectItem
                      key={item.id}
                      value={item.id}
                      disabled={!usable}
                    >
                      {usable ? item.label : `${item.label}（暂不支持）`}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="mt-2 text-slate-500 text-xs leading-5">
              {currentModel?.recommendation ?? "该 Provider 尚未配置"}
            </p>
          </Field>

          {operation === "edit" && canEdit ? (
            <Field label="参考图 URL" required>
              <Input
                type="url"
                value={referenceImageUrl}
                placeholder="https://..."
                aria-describedby="reference-hint"
                onChange={(event) => setReferenceImageUrl(event.target.value)}
              />
              <p id="reference-hint" className="mt-2 text-slate-500 text-xs">
                支持 1-{currentModel?.maxEditImages ?? 1} 张图片，首期使用公开
                URL。
              </p>
            </Field>
          ) : null}

          <Field label="提示词" required>
            <Textarea
              value={prompt}
              rows={5}
              placeholder="描述你想生成的画面..."
              aria-describedby="prompt-error"
              className="min-h-32 resize-y"
              onChange={(event) => setPrompt(event.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {PROMPTS.map((item) => (
                <button
                  type="button"
                  key={item}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-600 text-xs transition hover:border-emerald-300 hover:text-emerald-700"
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
                <Select
                  value={size}
                  items={sizeOptions.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  onValueChange={(value) => {
                    if (typeof value === "string") setSize(value);
                  }}
                >
                  <SelectTrigger aria-label="清晰度" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sizeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="生成数量">
                <Select
                  value={String(n)}
                  items={nOptions.map((opt) => ({
                    value: String(opt.value),
                    label: opt.label,
                  }))}
                  onValueChange={(value) => {
                    if (typeof value === "string") setN(Number(value));
                  }}
                >
                  <SelectTrigger aria-label="生成数量" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {nOptions.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          ) : null}

          {advancedFields.length > 0 ? (
            <details
              open={advancedOpen}
              onToggle={(e) =>
                setAdvancedOpen((e.currentTarget as HTMLDetailsElement).open)
              }
              className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2"
            >
              <summary className="cursor-pointer font-medium text-slate-700 text-sm">
                高级选项
              </summary>
              <div className="mt-3 grid gap-3">
                {advancedFields.map((field) => (
                  <AdvancedFieldControl
                    key={field.id}
                    field={field}
                    value={advancedValues[field.id]}
                    onChange={(value) =>
                      setAdvancedValues((prev) => ({
                        ...prev,
                        [field.id]: value,
                      }))
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
              className="rounded-lg bg-red-50 px-3 py-2 text-red-700 text-sm"
            >
              {validationError}
            </p>
          ) : null}

          <div className="flex gap-2 border-slate-100 border-t pt-4">
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
            <p className="text-amber-700 text-xs leading-5">
              当前 Provider 未在服务端配置。请在上方「填写你的 API
              Key」中提供完整凭证后开始体验。
            </p>
          ) : null}
        </div>
      </aside>

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
      // biome-ignore lint/a11y/noLabelWithoutControl: shadcn Checkbox renders a native button control inside the label
      <label className="flex items-center gap-2 text-slate-700 text-sm">
        <Checkbox
          checked={typeof value === "boolean" ? value : false}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        {field.label}
      </label>
    );
  }
  if (field.kind === "select") {
    const options = field.options ?? [];
    return (
      <Field label={field.label}>
        <Select
          value={typeof value === "string" && value !== "" ? value : null}
          items={options.map((opt) => ({
            value: opt.value,
            label: opt.label,
          }))}
          onValueChange={(next) => {
            if (typeof next === "string") onChange(next);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="未指定" />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    );
  }
  if (field.kind === "number") {
    return (
      <Field label={field.label}>
        <Input
          type="number"
          value={typeof value === "number" ? String(value) : ""}
          onChange={(event) =>
            onChange(
              event.target.value === "" ? "" : Number(event.target.value)
            )
          }
        />
      </Field>
    );
  }
  return (
    <Field label={field.label}>
      <Input
        type="text"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

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
  if (
    family === "qwen-multimodal" ||
    family === "wan-image-2.6" ||
    family === "wan-image-2.7"
  ) {
    return "aliyun";
  }
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
