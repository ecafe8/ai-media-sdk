"use client";

import { ImagePlus, LoaderCircle } from "lucide-react";

import { toImageUrl } from "@ai-media/sdk";

import type { PlaygroundResponse } from "@/lib/playground/types";

/**
 * Result feed for the Playground.
 *
 * Renders the Empty / Processing / Failure / Success states for both image
 * and video modalities. Extracted from the previous monolithic Playground
 * component so the ImageWorkbench and VideoWorkbench can share rendering
 * without carrying result state themselves.
 */

export interface ResultFeedProps {
  readonly result: PlaygroundResponse | undefined;
  readonly prompt: string;
  readonly provider: string;
  readonly model: string;
  readonly configured: boolean;
}

export function ResultFeed({
  result,
  prompt,
  provider,
  model,
  configured,
}: ResultFeedProps) {
  if (!result) {
    return <EmptyState configured={configured} />;
  }
  if (result.status === "processing") {
    return <ProcessingState provider={provider} model={model} />;
  }
  if (result.status === "failed") {
    return <FailureState message={result.error?.message ?? "请求失败"} />;
  }
  return <SuccessState result={result} prompt={prompt} />;
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
