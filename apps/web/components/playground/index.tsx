"use client";

import { ImagePlus, LoaderCircle, Sparkles, WandSparkles } from "lucide-react";
import { useState } from "react";

import { toImageUrl } from "@ai-media/sdk";
import { Button } from "@workspace/ui/components/shadcn/button";

import { PLAYGROUND_PROVIDERS } from "@/lib/playground/registry";
import type {
  PlaygroundModel,
  PlaygroundMode,
  PlaygroundProvider,
  PlaygroundResponse,
} from "@/lib/playground/types";

interface PlaygroundProps {
  readonly models: readonly PlaygroundModel[];
}

const PROMPTS = ["竖版的王国保卫战游戏界面", "一张可爱的人像摄影"];

export function Playground({ models }: PlaygroundProps) {
  const configuredModels = models.filter((model) => model.configured);
  const firstModel = configuredModels[0] ?? models[0];
  const [provider, setProvider] = useState<PlaygroundProvider>(
    firstModel?.provider ?? "azure-openai"
  );
  const [modelId, setModelId] = useState(firstModel?.id ?? "gpt-image-2");
  const [mode, setMode] = useState<PlaygroundMode>("generate");
  const [prompt, setPrompt] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [referenceImageUrlsText, setReferenceImageUrlsText] = useState("");
  const [inputVideoUrl, setInputVideoUrl] = useState("");
  const [size, setSize] = useState("1024*1024");
  const [n, setN] = useState("1");
  const [resolution, setResolution] = useState("720P");
  const [duration, setDuration] = useState("5");
  const [audioSetting, setAudioSetting] = useState("auto");
  const [result, setResult] = useState<PlaygroundResponse>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState("");

  const providerModels = models.filter((model) => model.provider === provider);
  const currentModel = models.find(
    (model) => model.provider === provider && model.id === modelId
  );
  const canEdit = currentModel?.supportsEdit ?? false;
  const canVideo = currentModel?.supportsVideo ?? false;
  const isVideo = mode === "video";
  const needsFirstFrame = currentModel?.requiresFirstFrame ?? false;
  const needsInputVideo = currentModel?.requiresInputVideo ?? false;
  const maxRefs = currentModel?.maxReferenceImages;

  function changeProvider(nextProvider: PlaygroundProvider) {
    const nextModels = models.filter(
      (model) => model.provider === nextProvider
    );
    setProvider(nextProvider);
    const next = nextModels[0];
    setModelId(next?.id ?? "");
    if (next?.supportsVideo) {
      setMode("video");
    } else {
      setMode("generate");
    }
    setReferenceImageUrl("");
    setReferenceImageUrlsText("");
    setInputVideoUrl("");
  }

  function changeModel(nextModelId: string) {
    const nextModel = models.find((model) => model.id === nextModelId);
    setModelId(nextModelId);
    if (nextModel?.supportsVideo) {
      setMode("video");
    } else if (!nextModel?.supportsEdit) {
      setMode("generate");
      setReferenceImageUrl("");
    } else {
      setMode("generate");
    }
  }

  async function submit() {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setValidationError("请输入提示词后再开始生成。");
      return;
    }
    if (mode === "edit" && !isValidHttpUrl(referenceImageUrl)) {
      setValidationError("编辑模式需要一个有效的图片 URL。");
      return;
    }
    if (isVideo && needsFirstFrame && !isValidHttpUrl(referenceImageUrl)) {
      setValidationError("该视频模型需要一个有效的首帧图片 URL。");
      return;
    }
    if (isVideo && needsInputVideo && !isValidHttpUrl(inputVideoUrl)) {
      setValidationError("该视频模型需要一个有效的公网视频 URL。");
      return;
    }
    if (
      isVideo &&
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

    setValidationError("");
    setIsSubmitting(true);
    setResult({ status: "processing" });
    try {
      const body: Record<string, unknown> = {
        provider,
        model: modelId,
        mode,
        prompt: trimmedPrompt,
      };
      if (mode === "edit") {
        body.referenceImageUrl = referenceImageUrl;
      } else if (isVideo) {
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
        if (!needsInputVideo) {
          body.duration = Number(duration);
        }
      } else {
        body.size = size;
        body.n = Number(n);
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

  function reset() {
    setMode("generate");
    setPrompt("");
    setReferenceImageUrl("");
    setReferenceImageUrlsText("");
    setInputVideoUrl("");
    setResult(undefined);
    setValidationError("");
  }

  return (
    <main className="min-h-svh bg-[#f7f8fa] text-slate-900">
      <header className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.24em] text-emerald-600 uppercase">
              AI Media SDK
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">
              Image Playground
            </h1>
          </div>
          <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Controlled developer environment
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-5 p-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:p-6">
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-4">
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <WandSparkles className="size-4" />
            </div>
            <div>
              <h2 className="font-semibold">生成工作台</h2>
              <p className="text-xs text-slate-500">配置模型并运行一次请求</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-3 rounded-lg bg-slate-100 p-1 text-sm">
              <button
                type="button"
                aria-pressed={mode === "generate"}
                className={`rounded-md px-3 py-2 transition ${mode === "generate" ? "bg-white font-medium shadow-sm" : "text-slate-500"}`}
                onClick={() => setMode("generate")}
              >
                文生图
              </button>
              <button
                type="button"
                aria-pressed={mode === "edit"}
                disabled={!canEdit}
                className={`rounded-md px-3 py-2 transition ${mode === "edit" ? "bg-white font-medium shadow-sm" : "text-slate-500"} disabled:cursor-not-allowed disabled:opacity-40`}
                onClick={() => setMode("edit")}
              >
                图生图
              </button>
              <button
                type="button"
                aria-pressed={isVideo}
                disabled={!canVideo}
                className={`rounded-md px-3 py-2 transition ${isVideo ? "bg-white font-medium shadow-sm" : "text-slate-500"} disabled:cursor-not-allowed disabled:opacity-40`}
                onClick={() => setMode("video")}
              >
                视频
              </button>
            </div>

            <Field label="Provider">
              <select
                value={provider}
                aria-label="Provider"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => changeModel(event.target.value)}
              >
                {providerModels.map((item) => {
                  const usable = item.supportsGenerate || item.supportsVideo;
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

            {mode === "edit" && canEdit ? (
              <Field label="参考图 URL" required>
                <input
                  type="url"
                  value={referenceImageUrl}
                  placeholder="https://..."
                  aria-describedby="reference-hint"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  onChange={(event) => setReferenceImageUrl(event.target.value)}
                />
                <p id="reference-hint" className="mt-2 text-xs text-slate-500">
                  支持 1-{currentModel?.maxEditImages ?? 1} 张图片，首期使用公开
                  URL。
                </p>
              </Field>
            ) : null}

            {isVideo && needsFirstFrame ? (
              <Field label="首帧图片 URL" required>
                <input
                  type="url"
                  value={referenceImageUrl}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  onChange={(event) => setReferenceImageUrl(event.target.value)}
                />
                <p className="mt-2 text-xs text-slate-500">
                  宽高比自动跟随首帧，i2v 不支持 ratio。
                </p>
              </Field>
            ) : null}

            {isVideo && needsInputVideo ? (
              <Field label="源视频 URL" required>
                <input
                  type="url"
                  value={inputVideoUrl}
                  placeholder="https://.../source.mp4"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  onChange={(event) => setInputVideoUrl(event.target.value)}
                />
                <p className="mt-2 text-xs text-slate-500">
                  仅公网 http/https URL；不支持 base64 或本地文件。
                </p>
              </Field>
            ) : null}

            {isVideo && maxRefs && !needsFirstFrame ? (
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
                  className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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

            {isVideo ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="分辨率">
                  <select
                    value={resolution}
                    aria-label="分辨率"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    onChange={(event) => setResolution(event.target.value)}
                  >
                    {needsInputVideo ? null : (
                      <option value="480P">480P</option>
                    )}
                    <option value="720P">720P</option>
                    <option value="1080P">1080P</option>
                  </select>
                </Field>
                {needsInputVideo ? (
                  <Field label="声音设置">
                    <select
                      value={audioSetting}
                      aria-label="声音设置"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      onChange={(event) => setAudioSetting(event.target.value)}
                    >
                      <option value="auto">auto（模型控制）</option>
                      <option value="origin">origin（保留原声）</option>
                    </select>
                  </Field>
                ) : (
                  <Field label="时长（秒）">
                    <select
                      value={duration}
                      aria-label="时长"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      onChange={(event) => setDuration(event.target.value)}
                    >
                      <option value="3">3 秒</option>
                      <option value="5">5 秒</option>
                      <option value="10">10 秒</option>
                      <option value="15">15 秒</option>
                    </select>
                  </Field>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="清晰度">
                  <select
                    value={size}
                    aria-label="清晰度"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    onChange={(event) => setSize(event.target.value)}
                  >
                    <option value="1024*1024">1K</option>
                    <option value="1536*1024">2K 横图</option>
                    <option value="1024*1536">2K 竖图</option>
                  </select>
                </Field>
                <Field label="生成数量">
                  <select
                    value={n}
                    aria-label="生成数量"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    onChange={(event) => setN(event.target.value)}
                  >
                    <option value="1">1 张</option>
                    <option value="2">2 张</option>
                    <option value="4">4 张</option>
                  </select>
                </Field>
              </div>
            )}

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

          {!result ? (
            <EmptyState configured={configuredModels.length > 0} />
          ) : result.status === "processing" ? (
            <ProcessingState provider={provider} model={modelId} />
          ) : result.status === "failed" ? (
            <FailureState message={result.error?.message ?? "请求失败"} />
          ) : (
            <SuccessState result={result} prompt={prompt} />
          )}
        </section>
      </div>

      <footer className="mx-auto max-w-[1440px] px-5 pb-6 text-xs text-slate-400">
        API Key 仅从服务端环境读取，浏览器不会接触 Provider 凭证。Playground
        不保存历史结果。
      </footer>
    </main>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label} {required ? <span className="text-red-500">*</span> : null}
      <div className="mt-2 font-normal">{children}</div>
    </label>
  );
}

function EmptyState({ configured }: { configured: boolean }) {
  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 text-center">
      <div className="rounded-2xl bg-white p-4 text-slate-400 shadow-sm">
        <ImagePlus className="size-8" />
      </div>
      <h3 className="mt-5 font-semibold">还没有生成结果</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {configured
          ? "在左侧填写提示词并开始一次受控生成。"
          : "先配置一个 Provider，再开始测试。"}
      </p>
    </div>
  );
}

function ProcessingState({
  provider,
  model,
}: {
  provider: string;
  model: string;
}) {
  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
      <LoaderCircle className="size-10 animate-spin text-emerald-600" />
      <h3 className="mt-5 font-semibold">正在处理</h3>
      <p className="mt-2 text-sm text-slate-500">
        {provider} / {model}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        请勿重复提交，Provider 结果可能是临时 URL。
      </p>
    </div>
  );
}

function FailureState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
      <div className="rounded-full bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
        生成失败
      </div>
      <p className="mt-4 max-w-md text-sm leading-6 text-slate-600">
        {message}
      </p>
      <p className="mt-2 text-xs text-slate-400">
        可修改左侧输入后重试，不会自动切换 Provider。
      </p>
    </div>
  );
}

function SuccessState({
  result,
  prompt,
}: {
  result: PlaygroundResponse;
  prompt: string;
}) {
  if (result.modality === "video") {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
            视频生成成功
          </span>
          <span>{result.metadata?.provider}</span>
          <span>/</span>
          <span>{result.metadata?.model}</span>
        </div>
        <p className="mb-5 text-sm text-slate-600">{prompt}</p>
        <div className="grid gap-3">
          {result.videos?.map((video, index) => (
            <div
              key={`${video.url ?? "video"}-${index}`}
              className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
            >
              <div className="flex items-center justify-center bg-slate-900">
                {video.url ? (
                  <video
                    src={video.url}
                    controls
                    className="max-h-[480px] w-full object-contain"
                  />
                ) : (
                  <ImagePlus className="size-8 text-white/80" />
                )}
              </div>
              <div className="space-y-1 p-3 text-xs text-slate-500">
                <p>
                  {video.mimeType ?? "video/mp4"}{" "}
                  {video.duration ? `${video.duration}s` : ""}
                </p>
                {video.url ? (
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-emerald-700 hover:underline"
                  >
                    {video.url}
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
          生成成功
        </span>
        <span>{result.metadata?.provider}</span>
        <span>/</span>
        <span>{result.metadata?.model}</span>
      </div>
      <p className="mb-5 text-sm text-slate-600">{prompt}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {result.images?.map((image, index) => (
          <div
            key={`${image.url ?? image.base64?.slice(0, 16) ?? "image"}-${index}`}
            className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
          >
            <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-emerald-300 via-teal-500 to-slate-800">
              {toImageUrl(image) ? (
                <img
                  src={toImageUrl(image)}
                  alt={`生成结果 ${index + 1}`}
                  className="size-full object-cover"
                />
              ) : (
                <ImagePlus className="size-8 text-white/80" />
              )}
            </div>
            <div className="space-y-1 p-3 text-xs text-slate-500">
              <p>
                {image.mimeType ?? "image/png"}{" "}
                {image.width && image.height
                  ? `${image.width}×${image.height}`
                  : ""}
              </p>
              {toImageUrl(image) ? (
                <a
                  href={toImageUrl(image)}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-emerald-700 hover:underline"
                >
                  {image.url ?? "查看图片数据"}
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
