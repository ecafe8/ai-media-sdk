import { Button } from "@workspace/ui/components/shadcn/button";
import { LoaderCircle, Sparkles, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { ImageSourceField } from "@/components/image-source-field";
import { executeSiteRequest } from "@/lib/executor";
import { type ImageSelection, resolveImageInput } from "@/lib/image-input";
import {
  PROVIDER_LABELS,
  SITE_PROVIDERS,
  type SiteProvider,
} from "@/lib/key-store";
import type { SiteModel, SitePlaygroundResponse } from "@/lib/playground/types";
import {
  Field,
  inputClassName,
  selectClassName,
  textareaClassName,
} from "../lib/field";
import {
  type ImageAdvancedFieldId,
  imageAdvancedFieldSet,
  imageNOptions,
  imageSizeOptions,
} from "../lib/image-form-schema";
import { ResultPanel } from "../result-panel";

const PROMPTS = ["竖版的王国保卫战游戏界面", "一张可爱的人像摄影"];

interface ImageWorkbenchProps {
  readonly models: readonly SiteModel[];
  readonly configuredProviders: ReadonlySet<SiteProvider>;
  readonly onOpenSettings: () => void;
}

/**
 * Image-modality workbench. Calls the client executor directly; image
 * inputs accept URL paste or local upload via `ImageSourceField`.
 */
export function ImageWorkbench({
  models,
  configuredProviders,
  onOpenSettings,
}: ImageWorkbenchProps) {
  const imageModels = useMemo(
    () =>
      models.filter(
        (m) => m.modality === "image" && (m.supportsGenerate || m.supportsEdit)
      ),
    [models]
  );
  const configuredModels = imageModels.filter((m) =>
    configuredProviders.has(m.provider)
  );
  const firstModel = configuredModels[0] ?? imageModels[0];

  const [provider, setProvider] = useState<SiteProvider>(
    firstModel?.provider ?? "azure-openai"
  );
  const [modelId, setModelId] = useState(firstModel?.id ?? "gpt-image-2");
  const [operation, setOperation] = useState<"generate" | "edit">("generate");
  const [prompt, setPrompt] = useState("");
  const [referenceImage, setReferenceImage] = useState<
    ImageSelection | undefined
  >(undefined);
  const [advancedValues, setAdvancedValues] = useState<
    Partial<Record<ImageAdvancedFieldId, string | number | boolean>>
  >({});
  const [result, setResult] = useState<SitePlaygroundResponse>();
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

  const providerConfigured = configuredProviders.has(provider);

  const sizeOptions = currentModel ? imageSizeOptions(currentModel) : [];
  const nOptions = currentModel ? imageNOptions(currentModel) : [];

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

  function changeProvider(nextProvider: SiteProvider) {
    const nextModels = imageModels.filter((m) => m.provider === nextProvider);
    setProvider(nextProvider);
    const next = nextModels[0];
    setModelId(next?.id ?? "");
    setReferenceImage(undefined);
  }

  function changeModel(nextModelId: string) {
    setModelId(nextModelId);
    setReferenceImage(undefined);
  }

  function reset() {
    setOperation("generate");
    setPrompt("");
    setReferenceImage(undefined);
    setAdvancedValues({});
    setResult(undefined);
    setValidationError("");
  }

  async function submit() {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setValidationError("请输入提示词后再开始生成。");
      return;
    }
    if (!providerConfigured) {
      setValidationError("该 Provider 尚未配置凭证，请先在 API 设置中填写。");
      return;
    }
    if (operation === "edit" && !referenceImage) {
      setValidationError("编辑模式需要一张参考图（URL 或本地上传）。");
      return;
    }

    setValidationError("");
    setIsSubmitting(true);
    setResult({ status: "processing" });
    try {
      const resolvedReference = await resolveImageInput(referenceImage);
      if (operation === "edit" && !resolvedReference) {
        setResult(undefined);
        setValidationError("参考图缓存已失效，请重新选择图片。");
        return;
      }

      const ns = advancedNamespace(currentModel?.family);
      let providerOptions:
        | Readonly<Record<string, Record<string, unknown>>>
        | undefined;
      if (ns) {
        const picked = pickAdvancedValues(advancedFields, advancedValues);
        if (Object.keys(picked).length > 0) {
          providerOptions = { [ns]: picked };
        }
      }

      const response = await executeSiteRequest({
        provider,
        model: modelId,
        modality: "image",
        imageOperation: operation,
        prompt: trimmedPrompt,
        ...(operation === "edit" && resolvedReference
          ? { referenceImage: resolvedReference }
          : {}),
        ...(operation === "generate" ? { size, n } : {}),
        ...(providerOptions ? { providerOptions } : {}),
      });
      setResult(response);
    } catch {
      setResult({
        status: "failed",
        error: { code: "NETWORK_ERROR", message: "生成失败，请稍后重试。" },
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
            <select
              value={provider}
              aria-label="Provider"
              className={selectClassName}
              onChange={(event) =>
                changeProvider(event.target.value as SiteProvider)
              }
            >
              {SITE_PROVIDERS.map((item) => (
                <option key={item} value={item}>
                  {PROVIDER_LABELS[item]}
                  {configuredProviders.has(item) ? "" : "（未配置）"}
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
            <p className="mt-2 text-slate-500 text-xs leading-5">
              {currentModel?.recommendation ?? "该 Provider 暂无图像模型"}
            </p>
          </Field>

          {operation === "edit" && canEdit ? (
            <Field label="参考图" required>
              <ImageSourceField
                value={referenceImage}
                onChange={setReferenceImage}
              />
            </Field>
          ) : null}

          <Field label="提示词" required>
            <textarea
              value={prompt}
              rows={5}
              placeholder="描述你想生成的画面..."
              aria-describedby="prompt-error"
              className={`${textareaClassName} min-h-32`}
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
            <details className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2">
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
              disabled={isSubmitting}
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
          {!providerConfigured ? (
            <p className="text-amber-700 text-xs leading-5">
              当前 Provider 未配置凭证。
              <button
                type="button"
                className="ml-1 text-emerald-700 underline underline-offset-2"
                onClick={onOpenSettings}
              >
                去设置 API Key
              </button>
            </p>
          ) : null}
        </div>
      </aside>

      <ResultPanel
        result={result}
        prompt={prompt}
        provider={provider}
        model={modelId}
        configured={providerConfigured}
        modality="image"
      />
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
      <label className="flex items-center gap-2 text-slate-700 text-sm">
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
      <input
        type="text"
        value={typeof value === "string" ? value : ""}
        className={inputClassName}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function advancedNamespace(
  family: SiteModel["family"] | undefined
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
