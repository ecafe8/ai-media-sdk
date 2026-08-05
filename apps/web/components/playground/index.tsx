"use client";

import { useState } from "react";

import type { PlaygroundModel, PlaygroundModality } from "@/lib/playground/types";
import { ImageWorkbench } from "@/components/playground/image-workbench";
import { VideoWorkbench } from "@/components/playground/video-workbench";

interface PlaygroundProps {
  readonly models: readonly PlaygroundModel[];
}

/**
 * Playground shell.
 *
 * Owns the top-level modality tab state (图像 / 视频 / 音频-disabled) and
 * mounts the corresponding workbench. Switching tabs unmounts the previous
 * workbench (its internal state lives in `useState`, so the form fully
 * resets — no cross-modality field contamination).
 *
 * The 音频 tab is rendered visibly disabled with a tooltip ("即将推出")
 * because the SDK has no audio entry points yet; the core `Modality` union
 * reserves `"audio"` for a future phase.
 */
export function Playground({ models }: PlaygroundProps) {
  const [modality, setModality] = useState<PlaygroundModality>(() => {
    // Default to video if any configured video model exists; otherwise image.
    const hasConfiguredVideo = models.some(
      (m) => m.modality === "video" && m.configured
    );
    return hasConfiguredVideo ? "video" : "image";
  });

  return (
    <main className="min-h-svh bg-[#f7f8fa] text-slate-900">
      <header className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.24em] text-emerald-600 uppercase">
              AI Media SDK
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">
              Media Playground
            </h1>
          </div>
          <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Controlled developer environment
          </div>
        </div>
        <div className="mx-auto mt-4 max-w-[1440px]">
          <div className="inline-flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
            <ModalityTab
              active={modality === "image"}
              onClick={() => setModality("image")}
            >
              图像
            </ModalityTab>
            <ModalityTab
              active={modality === "video"}
              onClick={() => setModality("video")}
            >
              视频
            </ModalityTab>
            <ModalityTab
              active={false}
              disabled
              title="即将推出"
              onClick={() => undefined}
            >
              音频
            </ModalityTab>
          </div>
        </div>
      </header>

      {modality === "image" ? <ImageWorkbench models={models} /> : null}
      {modality === "video" ? <VideoWorkbench models={models} /> : null}

      <footer className="mx-auto max-w-[1440px] px-5 pb-6 text-xs text-slate-400">
        API Key 仅从服务端环境读取，浏览器不会接触 Provider 凭证。Playground
        不保存历史结果。
      </footer>
    </main>
  );
}

function ModalityTab({
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      title={title}
      className={`rounded-md px-4 py-2 transition ${
        active
          ? "bg-white font-medium shadow-sm"
          : "text-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
