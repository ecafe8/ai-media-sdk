import { Button } from "@workspace/ui/components/shadcn/button";
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

import { ImageListField } from "@/components/image-list-field";
import { ImageSourceField } from "@/components/image-source-field";
import { PageContainer } from "@/components/layout/page-container";
import { executeSiteRequest } from "@/lib/executor";
import { SITE_RESOURCES, type SiteResources, useSiteLang } from "@/lib/i18n";
import {
  type ImageSelection,
  isValidHttpUrl,
  resolveImageInput,
  resolveImageInputs,
} from "@/lib/image-input";
import {
  PROVIDER_LABELS,
  SITE_PROVIDERS,
  type SiteProvider,
} from "@/lib/key-store";
import { useModelText } from "@/lib/model-text";
import type {
  SiteModel,
  SitePlaygroundResponse,
  VideoScenario,
} from "@/lib/playground/types";
import { Field } from "../lib/field";
import {
  videoAudioSettingOptions,
  videoDurationOptions,
  videoRatioOptions,
  videoResolutionOptions,
  videoShowsAudioSetting,
  videoShowsDuration,
  videoShowsRatio,
} from "../lib/video-form-schema";
import { ResultPanel } from "../result-panel";

type ValidationKey = keyof SiteResources["playground"]["validation"];

interface ValidationError {
  readonly key: ValidationKey;
  readonly count?: number;
}

const SCENARIOS: readonly VideoScenario[] = ["t2v", "i2v", "r2v"];

interface VideoWorkbenchProps {
  readonly models: readonly SiteModel[];
  readonly configuredProviders: ReadonlySet<SiteProvider>;
  readonly onOpenSettings: () => void;
}

/**
 * Video-modality workbench.
 *
 * Flag-driven models (Aliyun HappyHorse t2v/i2v/r2v/video-edit) infer the
 * operation from registry flags; first frame and reference images support
 * local upload, and the video-edit source video remains a public URL input.
 * Multi-scenario models (MiniMax-H3, `videoScenarios.length > 1`) serve
 * t2v/i2v/r2v from one model id, so the workbench renders a scenario
 * selector that drives which inputs and parameter rules are shown.
 */
export function VideoWorkbench({
  models,
  configuredProviders,
  onOpenSettings,
}: VideoWorkbenchProps) {
  const { t } = useTranslation();
  const lang = useSiteLang();
  const modelText = useModelText();
  const samplePrompts = SITE_RESOURCES[lang].playground.samplePrompts.video;

  const videoModels = useMemo(
    () => models.filter((m) => m.modality === "video"),
    [models]
  );
  const configuredModels = videoModels.filter((m) =>
    configuredProviders.has(m.provider)
  );
  const firstModel = configuredModels[0] ?? videoModels[0];

  const [provider, setProvider] = useState<SiteProvider>(
    firstModel?.provider ?? "aliyun-bailian"
  );
  const [modelId, setModelId] = useState(
    firstModel?.id ?? "happyhorse-1.1-t2v"
  );
  const [scenario, setScenario] = useState<VideoScenario>("t2v");
  const [prompt, setPrompt] = useState("");
  const [firstFrame, setFirstFrame] = useState<ImageSelection | undefined>(
    undefined
  );
  const [lastFrame, setLastFrame] = useState<ImageSelection | undefined>(
    undefined
  );
  const [referenceImages, setReferenceImages] = useState<
    readonly ImageSelection[]
  >([]);
  const [referenceVideoUrlsText, setReferenceVideoUrlsText] = useState("");
  const [referenceAudioUrlsText, setReferenceAudioUrlsText] = useState("");
  const [inputVideoUrl, setInputVideoUrl] = useState("");
  const [result, setResult] = useState<SitePlaygroundResponse>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<ValidationError>();

  const providerModels = useMemo(
    () => videoModels.filter((m) => m.provider === provider),
    [videoModels, provider]
  );
  const currentModel = useMemo(
    () => videoModels.find((m) => m.provider === provider && m.id === modelId),
    [videoModels, provider, modelId]
  );

  const providerConfigured = configuredProviders.has(provider);
  const isMultiScenario = (currentModel?.videoScenarios?.length ?? 0) > 1;

  const resolutionOptions = currentModel
    ? videoResolutionOptions(currentModel)
    : [];
  const ratioOptions = currentModel
    ? videoRatioOptions(currentModel, isMultiScenario ? scenario : undefined)
    : [];
  const durationOptions = videoDurationOptions(currentModel);
  const audioOptions = videoAudioSettingOptions();
  const showsRatio = currentModel
    ? videoShowsRatio(currentModel, isMultiScenario ? scenario : undefined)
    : false;
  const showsDuration = currentModel ? videoShowsDuration(currentModel) : true;
  const showsAudioSetting = currentModel
    ? videoShowsAudioSetting(currentModel)
    : false;

  const [resolution, setResolution] = useState(
    resolutionOptions[0]?.value ?? "720P"
  );
  const [ratio, setRatio] = useState(ratioOptions[0]?.value ?? "16:9");
  const [duration, setDuration] = useState(
    String(durationOptions[0]?.value ?? 5)
  );
  const [audioSetting, setAudioSetting] = useState(
    audioOptions[0]?.value ?? "auto"
  );

  const [prevModelKey, setPrevModelKey] = useState(
    `${provider}:${modelId}:${scenario}`
  );
  const modelKey = `${provider}:${modelId}:${scenario}`;
  if (modelKey !== prevModelKey) {
    setPrevModelKey(modelKey);
    if (!resolutionOptions.some((o) => o.value === resolution)) {
      setResolution(resolutionOptions[0]?.value ?? "720P");
    }
    if (!ratioOptions.some((o) => o.value === ratio)) {
      setRatio(ratioOptions[0]?.value ?? "16:9");
    }
    if (!durationOptions.some((o) => String(o.value) === duration)) {
      setDuration(String(durationOptions[0]?.value ?? 5));
    }
  }

  // Media-shape inputs. For multi-scenario models the active scenario drives
  // which inputs appear; flag-driven models use the registry flags.
  const needsFirstFrame = isMultiScenario
    ? scenario === "i2v"
    : (currentModel?.requiresFirstFrame ?? false);
  const needsInputVideo = isMultiScenario
    ? false
    : (currentModel?.requiresInputVideo ?? false);
  const maxRefs =
    isMultiScenario && scenario !== "r2v"
      ? undefined
      : currentModel?.maxReferenceImages;
  const showsLastFrame = isMultiScenario && scenario === "i2v";
  const showsRefMedia = isMultiScenario && scenario === "r2v";
  const maxRefVideos = currentModel?.maxReferenceVideos;
  const maxRefAudios = currentModel?.maxReferenceAudios;

  function changeProvider(nextProvider: SiteProvider) {
    const nextModels = videoModels.filter((m) => m.provider === nextProvider);
    setProvider(nextProvider);
    const next = nextModels[0];
    setModelId(next?.id ?? "");
    setScenario("t2v");
    clearMediaInputs();
  }

  function changeModel(nextModelId: string) {
    setModelId(nextModelId);
    setScenario("t2v");
    clearMediaInputs();
  }

  function changeScenario(nextScenario: VideoScenario) {
    if (nextScenario === scenario) return;
    setScenario(nextScenario);
    clearMediaInputs();
  }

  function clearMediaInputs() {
    setFirstFrame(undefined);
    setLastFrame(undefined);
    setReferenceImages([]);
    setReferenceVideoUrlsText("");
    setReferenceAudioUrlsText("");
    setInputVideoUrl("");
  }

  function reset() {
    setPrompt("");
    setScenario("t2v");
    clearMediaInputs();
    setResult(undefined);
    setValidationError(undefined);
  }

  function splitUrls(text: string): string[] {
    return text
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
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
    if (needsFirstFrame && !firstFrame) {
      setValidationError({ key: "firstFrameRequired" });
      return;
    }
    if (needsInputVideo && !isValidHttpUrl(inputVideoUrl)) {
      setValidationError({ key: "inputVideoRequired" });
      return;
    }
    if (
      maxRefs &&
      !needsFirstFrame &&
      !needsInputVideo &&
      referenceImages.length === 0
    ) {
      setValidationError({ key: "refsRequired", count: maxRefs });
      return;
    }
    const referenceVideoUrls = splitUrls(referenceVideoUrlsText);
    if (!referenceVideoUrls.every((url) => isValidHttpUrl(url))) {
      setValidationError({ key: "refVideosInvalid" });
      return;
    }
    const referenceAudioUrls = splitUrls(referenceAudioUrlsText);
    if (!referenceAudioUrls.every((url) => isValidHttpUrl(url))) {
      setValidationError({ key: "refAudiosInvalid" });
      return;
    }

    setValidationError(undefined);
    setIsSubmitting(true);
    setResult({ status: "processing" });
    try {
      const resolvedFirstFrame = await resolveImageInput(firstFrame);
      const resolvedLastFrame = await resolveImageInput(lastFrame);
      const { inputs: resolvedRefs, missing } =
        await resolveImageInputs(referenceImages);
      if ((needsFirstFrame && !resolvedFirstFrame) || missing > 0) {
        setResult(undefined);
        setValidationError({ key: "cacheMiss" });
        return;
      }

      const response = await executeSiteRequest({
        provider,
        model: modelId,
        modality: "video",
        prompt: trimmedPrompt,
        ...(resolvedFirstFrame ? { referenceImage: resolvedFirstFrame } : {}),
        ...(showsLastFrame && resolvedLastFrame
          ? { lastFrameImage: resolvedLastFrame }
          : {}),
        ...(resolvedRefs.length > 0 ? { referenceImages: resolvedRefs } : {}),
        ...(showsRefMedia && referenceVideoUrls.length > 0
          ? { referenceVideoUrls }
          : {}),
        ...(showsRefMedia && referenceAudioUrls.length > 0
          ? { referenceAudioUrls }
          : {}),
        ...(needsInputVideo ? { inputVideoUrl: inputVideoUrl.trim() } : {}),
        resolution,
        ...(showsRatio ? { ratio } : {}),
        ...(showsDuration ? { duration: Number(duration) } : {}),
        ...(showsAudioSetting ? { audioSetting } : {}),
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

  const operationKey = !currentModel
    ? "none"
    : isMultiScenario
      ? scenario === "i2v"
        ? "i2vFrames"
        : scenario === "r2v"
          ? "r2v"
          : "t2v"
      : currentModel.requiresInputVideo
        ? "edit"
        : currentModel.requiresFirstFrame
          ? "firstFrame"
          : currentModel.maxReferenceImages
            ? "r2v"
            : "t2v";

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
              {t("playground.videoWorkbench.title")}
            </h2>
            <p className="text-muted-foreground text-xs">
              {t(`playground.videoWorkbench.operation.${operationKey}`)}
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <Field label={t("common.provider")}>
            <Select
              value={provider}
              items={SITE_PROVIDERS.map((item) => {
                const hasVideo = videoModels.some((m) => m.provider === item);
                return {
                  value: item,
                  label: hasVideo
                    ? `${PROVIDER_LABELS[item]}${
                        configuredProviders.has(item)
                          ? ""
                          : t("common.notConfigured")
                      }`
                    : `${PROVIDER_LABELS[item]}${t("playground.videoWorkbench.noVideoModels")}`,
                };
              })}
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
                  {SITE_PROVIDERS.map((item) => {
                    const hasVideo = videoModels.some(
                      (m) => m.provider === item
                    );
                    return (
                      <SelectItem key={item} value={item} disabled={!hasVideo}>
                        {hasVideo
                          ? `${PROVIDER_LABELS[item]}${
                              configuredProviders.has(item)
                                ? ""
                                : t("common.notConfigured")
                            }`
                          : `${PROVIDER_LABELS[item]}${t("playground.videoWorkbench.noVideoModels")}`}
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field label={t("common.model")}>
            <Select
              value={modelId}
              items={providerModels.map((item) => ({
                value: item.id,
                label: modelText(item).label,
              }))}
              onValueChange={(value) => {
                if (typeof value === "string") changeModel(value);
              }}
            >
              <SelectTrigger aria-label={t("common.model")} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {providerModels.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {modelText(item).label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="mt-2 text-muted-foreground text-xs leading-5">
              {currentModelText?.recommendation ??
                t("playground.videoWorkbench.noModels")}
            </p>
          </Field>

          {isMultiScenario ? (
            <Field label={t("playground.videoWorkbench.scenario")}>
              <div className="flex flex-wrap gap-2">
                {SCENARIOS.map((item) => {
                  const active = scenario === item;
                  return (
                    <label
                      key={item}
                      className={
                        active
                          ? "cursor-pointer rounded-full border border-emerald-600 bg-emerald-600 px-3 py-1 text-white text-xs"
                          : "cursor-pointer rounded-full border border-border px-3 py-1 text-muted-foreground text-xs transition hover:border-emerald-300 hover:text-emerald-700 dark:hover:border-emerald-500/50 dark:hover:text-emerald-400"
                      }
                    >
                      <input
                        type="radio"
                        name="video-scenario"
                        className="sr-only"
                        checked={active}
                        onChange={() => changeScenario(item)}
                      />
                      {t(`playground.videoWorkbench.scenarioOptions.${item}`)}
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-muted-foreground text-xs leading-5">
                {t("playground.videoWorkbench.scenarioNote")}
              </p>
            </Field>
          ) : null}

          {needsFirstFrame ? (
            <Field
              label={t("playground.videoWorkbench.firstFrame.label")}
              required
            >
              <ImageSourceField value={firstFrame} onChange={setFirstFrame} />
              <p className="mt-2 text-muted-foreground text-xs">
                {t("playground.videoWorkbench.firstFrame.note")}
              </p>
            </Field>
          ) : null}

          {showsLastFrame ? (
            <Field label={t("playground.videoWorkbench.lastFrame.label")}>
              <ImageSourceField value={lastFrame} onChange={setLastFrame} />
              <p className="mt-2 text-muted-foreground text-xs">
                {t("playground.videoWorkbench.lastFrame.note")}
              </p>
            </Field>
          ) : null}

          {needsInputVideo ? (
            <Field
              label={t("playground.videoWorkbench.inputVideo.label")}
              required
            >
              <Input
                type="url"
                value={inputVideoUrl}
                placeholder="https://.../source.mp4"
                onChange={(event) => setInputVideoUrl(event.target.value)}
              />
              <p className="mt-2 text-muted-foreground text-xs">
                {t("playground.videoWorkbench.inputVideo.note")}
              </p>
            </Field>
          ) : null}

          {maxRefs && !needsFirstFrame ? (
            <Field
              label={t(
                needsInputVideo
                  ? "playground.videoWorkbench.refImages.optionalLabel"
                  : "playground.videoWorkbench.refImages.requiredLabel",
                { count: maxRefs }
              )}
              required={!needsInputVideo}
            >
              <ImageListField
                values={referenceImages}
                onChange={setReferenceImages}
                maxCount={maxRefs}
              />
              <p className="mt-2 text-muted-foreground text-xs">
                {t(
                  needsInputVideo
                    ? "playground.videoWorkbench.refImages.noteWithVideo"
                    : "playground.videoWorkbench.refImages.note"
                )}
              </p>
            </Field>
          ) : null}

          {showsRefMedia ? (
            <Field
              label={t("playground.videoWorkbench.refVideos.label", {
                count: maxRefVideos ?? 3,
              })}
            >
              <Textarea
                value={referenceVideoUrlsText}
                rows={2}
                placeholder="https://.../ref1.mp4"
                className="resize-y"
                onChange={(event) =>
                  setReferenceVideoUrlsText(event.target.value)
                }
              />
              <p className="mt-2 text-muted-foreground text-xs">
                {t("playground.videoWorkbench.refVideos.note")}
              </p>
            </Field>
          ) : null}

          {showsRefMedia ? (
            <Field
              label={t("playground.videoWorkbench.refAudios.label", {
                count: maxRefAudios ?? 3,
              })}
            >
              <Textarea
                value={referenceAudioUrlsText}
                rows={2}
                placeholder="https://.../ref1.mp3"
                className="resize-y"
                onChange={(event) =>
                  setReferenceAudioUrlsText(event.target.value)
                }
              />
              <p className="mt-2 text-muted-foreground text-xs">
                {t("playground.videoWorkbench.refAudios.note")}
              </p>
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

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("playground.resolution")}>
              <Select
                value={resolution}
                items={resolutionOptions.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
                onValueChange={(value) => {
                  if (typeof value === "string") setResolution(value);
                }}
              >
                <SelectTrigger
                  aria-label={t("playground.resolution")}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {resolutionOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            {showsRatio ? (
              <Field label={t("playground.aspectRatio")}>
                <Select
                  value={ratio}
                  items={ratioOptions.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  onValueChange={(value) => {
                    if (typeof value === "string") setRatio(value);
                  }}
                >
                  <SelectTrigger
                    aria-label={t("playground.aspectRatio")}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {ratioOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {showsDuration ? (
              <Field label={t("playground.duration")}>
                <Select
                  value={duration}
                  items={durationOptions.map((opt) => ({
                    value: String(opt.value),
                    label: t("fields.seconds", { count: opt.value }),
                  }))}
                  onValueChange={(value) => {
                    if (typeof value === "string") setDuration(value);
                  }}
                >
                  <SelectTrigger
                    aria-label={t("playground.duration")}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {durationOptions.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {t("fields.seconds", { count: opt.value })}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {showsAudioSetting ? (
              <Field label={t("playground.audioSetting")}>
                <Select
                  value={audioSetting}
                  items={audioOptions.map((opt) => ({
                    value: opt.value,
                    label: audioOptionLabel(opt.value),
                  }))}
                  onValueChange={(value) => {
                    if (typeof value === "string") setAudioSetting(value);
                  }}
                >
                  <SelectTrigger
                    aria-label={t("playground.audioSetting")}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {audioOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {audioOptionLabel(opt.value)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </div>

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
        modality="video"
      />
    </PageContainer>
  );

  function audioOptionLabel(value: string): string {
    if (value === "origin") return t("fields.audioOrigin");
    return t("fields.audioAuto");
  }
}
