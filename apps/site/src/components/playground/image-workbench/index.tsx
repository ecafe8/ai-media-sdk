import { Button } from "@workspace/ui/components/shadcn/button";
import { Checkbox } from "@workspace/ui/components/shadcn/checkbox";
import { Input } from "@workspace/ui/components/shadcn/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/shadcn/select";
import { Textarea } from "@workspace/ui/components/shadcn/textarea";
import { LoaderCircle, Sparkles, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ImageSourceField } from "@/components/image-source-field";
import { PageContainer } from "@/components/layout/page-container";
import { executeSiteRequest } from "@/lib/executor";
import { SITE_RESOURCES, type SiteResources, useSiteLang } from "@/lib/i18n";
import { type ImageSelection, resolveImageInput } from "@/lib/image-input";
import {
  PROVIDER_LABELS,
  SITE_PROVIDERS,
  type SiteProvider,
} from "@/lib/key-store";
import { useModelText } from "@/lib/model-text";
import type { SiteModel, SitePlaygroundResponse } from "@/lib/playground/types";
import { Field } from "../lib/field";
import {
  type ImageAdvancedFieldId,
  imageAdvancedFieldSet,
  imageNOptions,
  imageSizeOptions,
} from "../lib/image-form-schema";
import { ResultPanel } from "../result-panel";

interface ImageWorkbenchProps {
  readonly models: readonly SiteModel[];
  readonly configuredProviders: ReadonlySet<SiteProvider>;
  readonly onOpenSettings: () => void;
}

type ValidationKey = keyof SiteResources["playground"]["validation"];

interface ValidationError {
  readonly key: ValidationKey;
  readonly count?: number;
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
  const { t } = useTranslation();
  const lang = useSiteLang();
  const modelText = useModelText();
  const samplePrompts = SITE_RESOURCES[lang].playground.samplePrompts.image;

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
  const [validationError, setValidationError] = useState<ValidationError>();

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
    setValidationError(undefined);
  }

  async function submit() {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setValidationError({ key: "promptRequired" });
      return;
    }
    if (!providerConfigured) {
      setValidationError({ key: "providerNotConfigured" });
      return;
    }
    if (operation === "edit" && !referenceImage) {
      setValidationError({ key: "editNeedsReference" });
      return;
    }

    setValidationError(undefined);
    setIsSubmitting(true);
    setResult({ status: "processing" });
    try {
      const resolvedReference = await resolveImageInput(referenceImage);
      if (operation === "edit" && !resolvedReference) {
        setResult(undefined);
        setValidationError({ key: "referenceCacheMiss" });
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
        error: {
          code: "NETWORK_ERROR",
          message: "Generation failed; please try again later.",
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const currentModelText = currentModel ? modelText(currentModel) : undefined;

  return (
    <PageContainer className="grid gap-5 py-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:py-6">
      <aside className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-2 border-border/60 border-b pb-4">
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
            <WandSparkles className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold">
              {t("playground.imageWorkbench.title")}
            </h2>
            <p className="text-muted-foreground text-xs">
              {t("playground.imageWorkbench.subtitle")}
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 rounded-lg bg-muted p-1 text-sm">
            <button
              type="button"
              aria-pressed={operation === "generate"}
              className={`rounded-md px-3 py-2 transition ${operation === "generate" ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`}
              onClick={() => setOperation("generate")}
            >
              {t("playground.imageWorkbench.generate")}
            </button>
            <button
              type="button"
              aria-pressed={operation === "edit"}
              disabled={!canEdit}
              className={`rounded-md px-3 py-2 transition ${operation === "edit" ? "bg-card font-medium shadow-sm" : "text-muted-foreground"} disabled:cursor-not-allowed disabled:opacity-40`}
              onClick={() => setOperation("edit")}
            >
              {t("playground.imageWorkbench.edit")}
            </button>
          </div>

          <Field label={t("common.provider")}>
            <Select
              value={provider}
              items={SITE_PROVIDERS.map((item) => ({
                value: item,
                label: `${PROVIDER_LABELS[item]}${
                  configuredProviders.has(item) ? "" : t("common.notConfigured")
                }`,
              }))}
              onValueChange={(value) => {
                if (typeof value === "string") {
                  changeProvider(value as SiteProvider);
                }
              }}
            >
              <SelectTrigger
                aria-label={t("common.provider")}
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {SITE_PROVIDERS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {PROVIDER_LABELS[item]}
                      {configuredProviders.has(item)
                        ? ""
                        : t("common.notConfigured")}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field label={t("common.model")}>
            <Select
              value={modelId}
              items={providerModels.map((item) => {
                const usable = item.supportsGenerate || item.supportsEdit;
                const label = modelText(item).label;
                return {
                  value: item.id,
                  label: usable
                    ? label
                    : `${label}${t("playground.imageWorkbench.modelNotSupported")}`,
                };
              })}
              onValueChange={(value) => {
                if (typeof value === "string") changeModel(value);
              }}
            >
              <SelectTrigger aria-label={t("common.model")} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {providerModels.map((item) => {
                    const usable = item.supportsGenerate || item.supportsEdit;
                    const label = modelText(item).label;
                    return (
                      <SelectItem
                        key={item.id}
                        value={item.id}
                        disabled={!usable}
                      >
                        {usable
                          ? label
                          : `${label}${t("playground.imageWorkbench.modelNotSupported")}`}
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="mt-2 text-muted-foreground text-xs leading-5">
              {currentModelText?.recommendation ??
                t("playground.imageWorkbench.noModels")}
            </p>
          </Field>

          {operation === "edit" && canEdit ? (
            <Field
              label={t("playground.imageWorkbench.referenceImage")}
              required
            >
              <ImageSourceField
                value={referenceImage}
                onChange={setReferenceImage}
              />
            </Field>
          ) : null}

          <Field label={t("playground.prompt.label")} required>
            <Textarea
              value={prompt}
              rows={5}
              placeholder={t("playground.prompt.placeholder")}
              aria-describedby="prompt-error"
              className="min-h-32 resize-y"
              onChange={(event) => setPrompt(event.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {samplePrompts.map((item) => (
                <button
                  type="button"
                  key={item}
                  className="rounded-full border border-border px-2.5 py-1 text-muted-foreground text-xs transition hover:border-emerald-300 hover:text-emerald-700 dark:hover:border-emerald-500/50 dark:hover:text-emerald-400"
                  onClick={() => setPrompt(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </Field>

          {operation === "generate" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("playground.size")}>
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
                  <SelectTrigger
                    aria-label={t("playground.size")}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {sizeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("playground.count")}>
                <Select
                  value={String(n)}
                  items={nOptions.map((opt) => ({
                    value: String(opt.value),
                    label: t("fields.nImages", { count: opt.value }),
                  }))}
                  onValueChange={(value) => {
                    if (typeof value === "string") setN(Number(value));
                  }}
                >
                  <SelectTrigger
                    aria-label={t("playground.count")}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {nOptions.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {t("fields.nImages", { count: opt.value })}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          ) : null}

          {advancedFields.length > 0 ? (
            <details className="rounded-lg border border-border bg-muted/50 px-3 py-2">
              <summary className="cursor-pointer font-medium text-foreground text-sm">
                {t("playground.advancedOptions")}
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
              className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-sm"
            >
              {t(`playground.validation.${validationError.key}`, {
                count: validationError.count ?? 0,
              })}
            </p>
          ) : null}

          <div className="flex gap-2 border-border/60 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={reset}
            >
              {t("common.reset")}
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
              {isSubmitting ? t("common.generating") : t("common.generate")}
            </Button>
          </div>
          {!providerConfigured ? (
            <p className="text-amber-600 text-xs leading-5 dark:text-amber-400">
              {t("playground.credentialsHint")}
              <button
                type="button"
                className="ml-1 text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
                onClick={onOpenSettings}
              >
                {t("playground.credentialsHintAction")}
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
    </PageContainer>
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
  const { t } = useTranslation();
  if (field.kind === "boolean") {
    return (
      // biome-ignore lint/a11y/noLabelWithoutControl: shadcn Checkbox renders a native button control inside the label
      <label className="flex items-center gap-2 text-foreground text-sm">
        <Checkbox
          checked={typeof value === "boolean" ? value : false}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        {t(field.label)}
      </label>
    );
  }
  if (field.kind === "select") {
    const options = field.options ?? [];
    return (
      <Field label={t(field.label)}>
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
            <SelectValue placeholder={t("common.unspecified")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    );
  }
  if (field.kind === "number") {
    return (
      <Field label={t(field.label)}>
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
    <Field label={t(field.label)}>
      <Input
        type="text"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function advancedNamespace(
  family: SiteModel["family"] | undefined
): "azure" | "aliyun" | "volcengine" | undefined {
  if (!family) return undefined;
  if (family === "azure-gpt-image") return "azure";
  if (
    family === "qwen-multimodal" ||
    family === "wan-image-2.6" ||
    family === "wan-image-2.7"
  ) {
    return "aliyun";
  }
  if (family.startsWith("doubao-seedream")) return "volcengine";
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
