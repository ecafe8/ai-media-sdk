"use client";

import { LoaderCircle, Sparkles, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@workspace/ui/components/shadcn/button";

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
import {
  Field,
  inputClassName,
  selectClassName,
  textareaClassName,
} from "../lib/field";
import { isValidHttpUrl } from "../lib/http";
import { ResultFeed } from "../result-feed";
import {
  videoAudioSettingOptions,
  videoDurationOptions,
  videoRatioOptions,
  videoResolutionOptions,
  videoShowsAudioSetting,
  videoShowsDuration,
  videoShowsRatio,
} from "../lib/video-form-schema";

const PROMPTS = ["霓虹城市的雨夜街景，电影感", "纸飞机穿越森林的稳定跟踪镜头"];

interface VideoWorkbenchProps {
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
 * Video-modality workbench.
 *
 * Owns its own form state (provider, model, prompt, first-frame/input-video
 * /reference-image URLs, resolution/ratio/duration/audio_setting). The
 * video operation (t2v/i2v/r2v/video-edit) is inferred from the selected
 * model's `requiresFirstFrame`/`requiresInputVideo`/`maxReferenceImages`
 * flags; the form does not expose a separate operation toggle.
 *
 * On model change, the resolution/ratio/duration dropdowns are re-derived
 * from the new model's metadata and reset to the first option. video-edit
 * hides 480P/ratio/duration and shows `audio_setting` instead.
 */
export function VideoWorkbench({
  models,
  credentialsMap,
  serverConfiguredProviders,
  onCredentialsChange,
  onCredentialsClear,
}: VideoWorkbenchProps) {
  const videoModels = useMemo(
    () => models.filter((m) => m.modality === "video"),
    [models]
  );
  const configuredModels = videoModels.filter((m) => m.configured);
  const firstModel = configuredModels[0] ?? videoModels[0];

  const [provider, setProvider] = useState<PlaygroundProvider>(
    firstModel?.provider ?? "aliyun-bailian"
  );
  const [modelId, setModelId] = useState(
    firstModel?.id ?? "happyhorse-1.1-t2v"
  );
  const [prompt, setPrompt] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [referenceImageUrlsText, setReferenceImageUrlsText] = useState("");
  const [inputVideoUrl, setInputVideoUrl] = useState("");
  const [result, setResult] = useState<PlaygroundResponse>();
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

  const resolutionOptions = currentModel
    ? videoResolutionOptions(currentModel)
    : [];
  const ratioOptions = currentModel ? videoRatioOptions(currentModel) : [];
  const durationOptions = videoDurationOptions();
  const audioOptions = videoAudioSettingOptions();
  const showsRatio = currentModel ? videoShowsRatio(currentModel) : false;
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

  // Re-seed resolution/ratio/duration defaults when the model changes.
  // Uses the React-endorsed "adjust state during render" pattern instead
  // of useEffect to avoid a cascading render.
  const [prevModelKey, setPrevModelKey] = useState(`${provider}:${modelId}`);
  const modelKey = `${provider}:${modelId}`;
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

  const needsFirstFrame = currentModel?.requiresFirstFrame ?? false;
  const needsInputVideo = currentModel?.requiresInputVideo ?? false;
  const maxRefs = currentModel?.maxReferenceImages;

  function changeProvider(nextProvider: PlaygroundProvider) {
    const nextModels = videoModels.filter((m) => m.provider === nextProvider);
    setProvider(nextProvider);
    const next = nextModels[0];
    setModelId(next?.id ?? "");
    setReferenceImageUrl("");
    setReferenceImageUrlsText("");
    setInputVideoUrl("");
  }

  function changeModel(nextModelId: string) {
    setModelId(nextModelId);
    setReferenceImageUrl("");
    setReferenceImageUrlsText("");
    setInputVideoUrl("");
  }

  function reset() {
    setPrompt("");
    setReferenceImageUrl("");
    setReferenceImageUrlsText("");
    setInputVideoUrl("");
    setResult(undefined);
    setValidationError("");
  }

  async function submit() {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setValidationError("请输入提示词后再开始生成。");
      return;
    }
    if (needsFirstFrame && !isValidHttpUrl(referenceImageUrl)) {
      setValidationError("该视频模型需要一个有效的首帧图片 URL。");
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
      !referenceImageUrlsText.trim()
    ) {
      setValidationError(
        `该视频模型需要至少 1 张参考图 URL（最多 ${maxRefs} 张，逗号分隔）。`
      );
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
        modality: "video",
        prompt: trimmedPrompt,
        ...(byoCredentials && isCredentialsComplete(provider, byoCredentials)
          ? { credentials: byoCredentials }
          : {}),
      };
      if (needsFirstFrame && referenceImageUrl) {
        body.referenceImageUrl = referenceImageUrl;
      }
      if (needsInputVideo) {
        body.inputVideoUrl = inputVideoUrl;
        if (referenceImageUrlsText.trim()) {
          body.referenceImageUrls = referenceImageUrlsText
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }
      if (maxRefs && !needsFirstFrame && !needsInputVideo) {
        body.referenceImageUrls = referenceImageUrlsText
          .split(/[,\n]/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      body.resolution = resolution;
      if (showsRatio) {
        body.ratio = ratio;
      }
      if (showsDuration) {
        body.duration = Number(duration);
      }
      if (showsAudioSetting) {
        body.audioSetting = audioSetting;
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
            <h2 className="font-semibold">视频工作台</h2>
            <p className="text-xs text-slate-500">
              {operationLabel(currentModel)}
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <Field label="Provider">
            <select
              value={provider}
              aria-label="Provider"
              className={selectClassName}
              onChange={(event) =>
                changeProvider(event.target.value as PlaygroundProvider)
              }
            >
              {PLAYGROUND_PROVIDERS.map((item) => {
                const hasVideo = videoModels.some(
                  (m) => m.provider === item.id
                );
                return (
                  <option key={item.id} value={item.id} disabled={!hasVideo}>
                    {hasVideo ? item.label : `${item.label}（无视频模型）`}
                  </option>
                );
              })}
            </select>
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
            <select
              value={modelId}
              aria-label="模型"
              className={selectClassName}
              onChange={(event) => changeModel(event.target.value)}
            >
              {providerModels.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {currentModel?.recommendation ?? "该 Provider 尚未配置视频模型"}
            </p>
          </Field>

          {needsFirstFrame ? (
            <Field label="首帧图片 URL" required>
              <input
                type="url"
                value={referenceImageUrl}
                placeholder="https://..."
                className={inputClassName}
                onChange={(event) => setReferenceImageUrl(event.target.value)}
              />
              <p className="mt-2 text-xs text-slate-500">
                宽高比自动跟随首帧，i2v 不支持 ratio。
              </p>
            </Field>
          ) : null}

          {needsInputVideo ? (
            <Field label="源视频 URL" required>
              <input
                type="url"
                value={inputVideoUrl}
                placeholder="https://.../source.mp4"
                className={inputClassName}
                onChange={(event) => setInputVideoUrl(event.target.value)}
              />
              <p className="mt-2 text-xs text-slate-500">
                仅公网 http/https URL；不支持 base64 或本地文件。
              </p>
            </Field>
          ) : null}

          {maxRefs && !needsFirstFrame ? (
            <Field
              label={
                needsInputVideo
                  ? `参考图 URL（可选，最多 ${maxRefs} 张）`
                  : `参考图 URL（最多 ${maxRefs} 张，逗号分隔）`
              }
              required={!needsInputVideo}
            >
              <textarea
                value={referenceImageUrlsText}
                rows={3}
                placeholder="https://.../ref1.png, https://.../ref2.png"
                className={textareaClassName}
                onChange={(event) =>
                  setReferenceImageUrlsText(event.target.value)
                }
              />
              <p className="mt-2 text-xs text-slate-500">
                {needsInputVideo
                  ? "可选参考图，按顺序对应 prompt 中的 [Image N]。"
                  : "按顺序对应 prompt 中的 [Image N]；宽高比跟随参数。"}
              </p>
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
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
                  onClick={() => setPrompt(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="分辨率">
              <select
                value={resolution}
                aria-label="分辨率"
                className={selectClassName}
                onChange={(event) => setResolution(event.target.value)}
              >
                {resolutionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
            {showsRatio ? (
              <Field label="长宽比">
                <select
                  value={ratio}
                  aria-label="长宽比"
                  className={selectClassName}
                  onChange={(event) => setRatio(event.target.value)}
                >
                  {ratioOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {showsDuration ? (
              <Field label="时长（秒）">
                <select
                  value={duration}
                  aria-label="时长"
                  className={selectClassName}
                  onChange={(event) => setDuration(event.target.value)}
                >
                  {durationOptions.map((opt) => (
                    <option key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {showsAudioSetting ? (
              <Field label="声音设置">
                <select
                  value={audioSetting}
                  aria-label="声音设置"
                  className={selectClassName}
                  onChange={(event) => setAudioSetting(event.target.value)}
                >
                  {audioOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
          </div>

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

/**
 * Derive a human-readable operation label for the workbench header from the
 * selected model's media-shape flags. Mirrors the adapter-side mode
 * inference so the UI matches server behaviour.
 */
function operationLabel(model: PlaygroundModel | undefined): string {
  if (!model) return "未选择";
  if (model.requiresInputVideo) return "视频编辑";
  if (model.requiresFirstFrame) return "首帧图生视频";
  if (model.maxReferenceImages) return "参考生视频";
  return "文生视频";
}
