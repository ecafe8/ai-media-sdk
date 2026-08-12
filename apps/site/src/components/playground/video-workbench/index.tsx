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

import { ImageListField } from "@/components/image-list-field";
import { ImageSourceField } from "@/components/image-source-field";
import { PageContainer } from "@/components/layout/page-container";
import { executeSiteRequest } from "@/lib/executor";
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

const PROMPTS = ["霓虹城市的雨夜街景，电影感", "纸飞机穿越森林的稳定跟踪镜头"];

/**
 * Scenario selector labels for multi-scenario models.
 */
const SCENARIO_LABELS: readonly {
  readonly value: VideoScenario;
  readonly label: string;
}[] = [
  { value: "t2v", label: "文生视频" },
  { value: "i2v", label: "图生视频" },
  { value: "r2v", label: "参考生视频" },
];

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
  const [validationError, setValidationError] = useState("");

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
    setValidationError("");
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
      setValidationError("请输入提示词后再开始生成。");
      return;
    }
    if (!providerConfigured) {
      setValidationError("该 Provider 尚未配置凭证，请先在 API 设置中填写。");
      return;
    }
    if (needsFirstFrame && !firstFrame) {
      setValidationError("该视频模型需要一张首帧图片（URL 或本地上传）。");
      return;
    }
    if (needsInputVideo && !isValidHttpUrl(inputVideoUrl)) {
      setValidationError("该视频模型需要一个有效的公网视频 URL。");
      return;
    }
    if (
      maxRefs &&
      !needsFirstFrame &&
      !needsInputVideo &&
      referenceImages.length === 0
    ) {
      setValidationError(
        `该视频模型需要至少 1 张参考图（最多 ${maxRefs} 张）。`
      );
      return;
    }
    const referenceVideoUrls = splitUrls(referenceVideoUrlsText);
    if (!referenceVideoUrls.every((url) => isValidHttpUrl(url))) {
      setValidationError("参考视频 URL 中存在无效地址，请检查后重试。");
      return;
    }
    const referenceAudioUrls = splitUrls(referenceAudioUrlsText);
    if (!referenceAudioUrls.every((url) => isValidHttpUrl(url))) {
      setValidationError("参考音频 URL 中存在无效地址，请检查后重试。");
      return;
    }

    setValidationError("");
    setIsSubmitting(true);
    setResult({ status: "processing" });
    try {
      const resolvedFirstFrame = await resolveImageInput(firstFrame);
      const resolvedLastFrame = await resolveImageInput(lastFrame);
      const { inputs: resolvedRefs, missing } =
        await resolveImageInputs(referenceImages);
      if ((needsFirstFrame && !resolvedFirstFrame) || missing > 0) {
        setResult(undefined);
        setValidationError("部分图片缓存已失效，请重新选择后再提交。");
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
        error: { code: "NETWORK_ERROR", message: "生成失败，请稍后重试。" },
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const operationLabel = !currentModel
    ? "未选择"
    : isMultiScenario
      ? scenario === "i2v"
        ? "图生视频（首尾帧）"
        : scenario === "r2v"
          ? "参考生视频"
          : "文生视频"
      : currentModel.requiresInputVideo
        ? "视频编辑"
        : currentModel.requiresFirstFrame
          ? "首帧图生视频"
          : currentModel.maxReferenceImages
            ? "参考生视频"
            : "文生视频";

  return (
    <PageContainer className="grid gap-5 py-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:py-6">
      <aside className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-2 border-border/60 border-b pb-4">
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
            <WandSparkles className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold">视频工作台</h2>
            <p className="text-muted-foreground text-xs">{operationLabel}</p>
          </div>
        </div>

        <div className="space-y-5">
          <Field label="Provider">
            <Select
              value={provider}
              items={SITE_PROVIDERS.map((item) => {
                const hasVideo = videoModels.some((m) => m.provider === item);
                return {
                  value: item,
                  label: hasVideo
                    ? `${PROVIDER_LABELS[item]}${
                        configuredProviders.has(item) ? "" : "（未配置）"
                      }`
                    : `${PROVIDER_LABELS[item]}（无视频模型）`,
                };
              })}
              onValueChange={(value) => {
                if (typeof value === "string") {
                  changeProvider(value as SiteProvider);
                }
              }}
            >
              <SelectTrigger aria-label="Provider" className="w-full">
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
                              configuredProviders.has(item) ? "" : "（未配置）"
                            }`
                          : `${PROVIDER_LABELS[item]}（无视频模型）`}
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field label="模型">
            <Select
              value={modelId}
              items={providerModels.map((item) => ({
                value: item.id,
                label: item.label,
              }))}
              onValueChange={(value) => {
                if (typeof value === "string") changeModel(value);
              }}
            >
              <SelectTrigger aria-label="模型" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {providerModels.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="mt-2 text-muted-foreground text-xs leading-5">
              {currentModel?.recommendation ?? "该 Provider 暂无视频模型"}
            </p>
          </Field>

          {isMultiScenario ? (
            <Field label="生成场景">
              <div className="flex flex-wrap gap-2">
                {SCENARIO_LABELS.map((item) => {
                  const active = scenario === item.value;
                  return (
                    <label
                      key={item.value}
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
                        onChange={() => changeScenario(item.value)}
                      />
                      {item.label}
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-muted-foreground text-xs leading-5">
                单个 MiniMax-H3
                模型覆盖三种场景，切换场景会清空已填写的媒体输入。
              </p>
            </Field>
          ) : null}

          {needsFirstFrame ? (
            <Field label="首帧图片" required>
              <ImageSourceField value={firstFrame} onChange={setFirstFrame} />
              <p className="mt-2 text-muted-foreground text-xs">
                宽高比自动跟随首帧（adaptive），图生视频不支持手动选择 ratio。
              </p>
            </Field>
          ) : null}

          {showsLastFrame ? (
            <Field label="尾帧图片（可选）">
              <ImageSourceField value={lastFrame} onChange={setLastFrame} />
              <p className="mt-2 text-muted-foreground text-xs">
                与首帧组合为首尾帧图生视频；留空则仅用首帧。
              </p>
            </Field>
          ) : null}

          {needsInputVideo ? (
            <Field label="源视频 URL" required>
              <Input
                type="url"
                value={inputVideoUrl}
                placeholder="https://.../source.mp4"
                onChange={(event) => setInputVideoUrl(event.target.value)}
              />
              <p className="mt-2 text-muted-foreground text-xs">
                仅支持公网 http/https URL；不支持本地文件、base64。
              </p>
            </Field>
          ) : null}

          {maxRefs && !needsFirstFrame ? (
            <Field
              label={
                needsInputVideo
                  ? `参考图（可选，最多 ${maxRefs} 张）`
                  : `参考图（最多 ${maxRefs} 张）`
              }
              required={!needsInputVideo}
            >
              <ImageListField
                values={referenceImages}
                onChange={setReferenceImages}
                maxCount={maxRefs}
              />
              <p className="mt-2 text-muted-foreground text-xs">
                {needsInputVideo
                  ? "可选参考图，按顺序对应 prompt 中的 [Image N]。"
                  : "按顺序对应 prompt 中的 [Image N]；宽高比跟随参数。"}
              </p>
            </Field>
          ) : null}

          {showsRefMedia ? (
            <Field
              label={`参考视频 URL（可选，最多 ${maxRefVideos ?? 3} 条，逗号分隔）`}
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
                仅公网 http/https URL；单条 2-15 秒，合计不超过 15 秒。
              </p>
            </Field>
          ) : null}

          {showsRefMedia ? (
            <Field
              label={`参考音频 URL（可选，最多 ${maxRefAudios ?? 3} 条，逗号分隔）`}
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
                仅公网 http/https URL；单条 2-15 秒，合计不超过 15 秒。
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
                  className="rounded-full border border-border px-2.5 py-1 text-muted-foreground text-xs transition hover:border-emerald-300 hover:text-emerald-700 dark:hover:border-emerald-500/50 dark:hover:text-emerald-400"
                  onClick={() => setPrompt(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="分辨率">
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
                <SelectTrigger aria-label="分辨率" className="w-full">
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
              <Field label="长宽比">
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
                  <SelectTrigger aria-label="长宽比" className="w-full">
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
              <Field label="时长（秒）">
                <Select
                  value={duration}
                  items={durationOptions.map((opt) => ({
                    value: String(opt.value),
                    label: opt.label,
                  }))}
                  onValueChange={(value) => {
                    if (typeof value === "string") setDuration(value);
                  }}
                >
                  <SelectTrigger aria-label="时长" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {durationOptions.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {showsAudioSetting ? (
              <Field label="声音设置">
                <Select
                  value={audioSetting}
                  items={audioOptions.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  onValueChange={(value) => {
                    if (typeof value === "string") setAudioSetting(value);
                  }}
                >
                  <SelectTrigger aria-label="声音设置" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {audioOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
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
              {validationError}
            </p>
          ) : null}

          <div className="flex gap-2 border-border/60 border-t pt-4">
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
            <p className="text-amber-600 text-xs leading-5 dark:text-amber-400">
              当前 Provider 未配置凭证。
              <button
                type="button"
                className="ml-1 text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
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
        modality="video"
      />
    </PageContainer>
  );
}
