import { toImageUrl } from "@ai-media/sdk";
import { ImagePlus, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useErrorText } from "@/lib/error-text";
import type { SiteProvider } from "@/lib/key-store";
import type { SitePlaygroundResponse } from "@/lib/playground/types";

/**
 * Result feed rendering Empty / Processing / Failure / Success states for
 * both image and video modalities.
 */

export interface ResultFeedProps {
  readonly result: SitePlaygroundResponse | undefined;
  readonly prompt: string;
  readonly provider: SiteProvider;
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
  const errorText = useErrorText();
  if (!result) {
    return <EmptyState configured={configured} />;
  }
  if (result.status === "processing") {
    return <ProcessingState provider={provider} model={model} />;
  }
  if (result.status === "failed") {
    return <FailureState message={errorText(result.error, provider)} />;
  }
  return <SuccessState result={result} prompt={prompt} />;
}

function EmptyState({ configured }: { configured: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-border border-dashed bg-muted/50 px-6 text-center">
      <div className="rounded-2xl bg-card p-4 text-muted-foreground shadow-sm">
        <ImagePlus className="size-8" />
      </div>
      <h3 className="mt-5 font-semibold">
        {t("playground.result.emptyTitle")}
      </h3>
      <p className="mt-2 max-w-sm text-muted-foreground text-sm leading-6">
        {configured
          ? t("playground.result.emptyConfigured")
          : t("playground.result.emptyUnconfigured")}
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
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
      <LoaderCircle className="size-10 animate-spin text-emerald-600" />
      <h3 className="mt-5 font-semibold">
        {t("playground.result.processingTitle")}
      </h3>
      <p className="mt-2 text-muted-foreground text-sm">
        {provider} / {model}
      </p>
      <p className="mt-1 text-muted-foreground/70 text-xs">
        {t("playground.result.processingNote")}
      </p>
    </div>
  );
}

function FailureState({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
      <div className="rounded-full bg-destructive/10 px-4 py-2 font-medium text-destructive text-sm">
        {t("playground.result.failedBadge")}
      </div>
      <p className="mt-4 max-w-md text-muted-foreground text-sm leading-6">
        {message}
      </p>
      <p className="mt-2 text-muted-foreground/70 text-xs">
        {t("playground.result.failedNote")}
      </p>
    </div>
  );
}

function SuccessState({
  result,
  prompt,
}: {
  result: SitePlaygroundResponse;
  prompt: string;
}) {
  const { t } = useTranslation();
  if (result.modality === "video") {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-medium text-emerald-700 dark:text-emerald-400">
            {t("playground.result.videoSuccess")}
          </span>
          <span>{result.metadata?.provider}</span>
          <span>/</span>
          <span>{result.metadata?.model}</span>
        </div>
        <p className="mb-5 text-foreground/80 text-sm">{prompt}</p>
        <div className="grid gap-3">
          {result.videos?.map((video, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: Stable prefix (url) plus index for collision safety when URLs repeat
              key={`${video.url ?? "video"}-${index}`}
              className="overflow-hidden rounded-xl border border-border bg-muted/50"
            >
              <div className="flex items-center justify-center bg-slate-900">
                {video.url ? (
                  // biome-ignore lint/a11y/useMediaCaption: Playground preview of generated video; captions out of scope
                  <video
                    src={video.url}
                    controls
                    className="max-h-[480px] w-full object-contain"
                  />
                ) : (
                  <ImagePlus className="size-8 text-white/80" />
                )}
              </div>
              <div className="space-y-1 p-3 text-muted-foreground text-xs">
                <p>
                  {video.mimeType ?? "video/mp4"}{" "}
                  {video.duration ? `${video.duration}s` : ""}
                </p>
                {video.url ? (
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-emerald-700 hover:underline dark:text-emerald-400"
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
      <div className="mb-4 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
        <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-medium text-emerald-700 dark:text-emerald-400">
          {t("playground.result.imageSuccess")}
        </span>
        <span>{result.metadata?.provider}</span>
        <span>/</span>
        <span>{result.metadata?.model}</span>
      </div>
      <p className="mb-5 text-foreground/80 text-sm">{prompt}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {result.images?.map((image, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: Stable prefix (url/base64) plus index for collision safety
            key={`${image.url ?? image.base64?.slice(0, 16) ?? "image"}-${index}`}
            className="overflow-hidden rounded-xl border border-border bg-muted/50"
          >
            <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-emerald-300 via-teal-500 to-slate-800">
              {toImageUrl(image) ? (
                <img
                  src={toImageUrl(image)}
                  alt={t("playground.result.imageAlt", { count: index + 1 })}
                  className="size-full object-cover"
                />
              ) : (
                <ImagePlus className="size-8 text-white/80" />
              )}
            </div>
            <div className="space-y-1 p-3 text-muted-foreground text-xs">
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
                  className="block truncate text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  {image.url ?? t("playground.result.viewImageData")}
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
