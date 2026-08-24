"use client";

import { useCallback, useMemo, useState } from "react";
import { AudioWorkbench } from "@/components/playground/audio-workbench";
import { ImageWorkbench } from "@/components/playground/image-workbench";
import { VideoWorkbench } from "@/components/playground/video-workbench";
import type {
  PlaygroundCredentials,
  PlaygroundModality,
  PlaygroundModel,
  PlaygroundProvider,
} from "@/lib/playground/types";
import {
  clearStoredCredentials,
  isCredentialsComplete,
  normalizeCredentials,
  setStoredCredentials,
  useStoredCredentials,
} from "./lib/credentials";

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
  // Providers configured server-side (from env). These never require BYO
  // credentials; BYO input is optional and takes precedence when supplied.
  const serverConfiguredProviders = useMemo(
    () =>
      new Set<PlaygroundProvider>(
        models.filter((m) => m.configured).map((m) => m.provider)
      ),
    [models]
  );

  // Visitor-supplied BYO credentials, backed by a localStorage external
  // store. Server render observes an empty map, so hydration is stable.
  const credentialsMap = useStoredCredentials();

  const handleCredentialsChange = useCallback(
    (provider: PlaygroundProvider, credentials: PlaygroundCredentials) => {
      setStoredCredentials(provider, credentials);
    },
    []
  );

  const handleCredentialsClear = useCallback((provider: PlaygroundProvider) => {
    clearStoredCredentials(provider);
  }, []);

  // Re-project the `configured` flag so a Provider with complete BYO
  // credentials behaves like a server-configured one in the workbenches.
  const effectiveModels = useMemo(
    () =>
      models.map((model) => {
        if (model.configured) return model;
        const byoComplete = isCredentialsComplete(
          model.provider,
          normalizeCredentials(credentialsMap[model.provider])
        );
        return byoComplete ? { ...model, configured: true } : model;
      }),
    [models, credentialsMap]
  );

  const [modality, setModality] = useState<PlaygroundModality>(() => {
    // Prefer configured media, while keeping image as the universal fallback.
    const hasConfiguredVideo = models.some(
      (m) => m.modality === "video" && m.configured
    );
    const hasConfiguredAudio = models.some(
      (m) => m.modality === "audio" && m.configured
    );
    return hasConfiguredVideo
      ? "video"
      : hasConfiguredAudio
        ? "audio"
        : "image";
  });

  return (
    <main className="min-h-svh bg-[#f7f8fa] text-slate-900">
      <header className="border-slate-200 border-b bg-white px-5 py-4">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between">
          <div>
            <p className="font-semibold text-emerald-600 text-xs uppercase tracking-[0.24em]">
              AI Media SDK
            </p>
            <h1 className="mt-1 font-semibold text-xl tracking-tight">
              Media Playground
            </h1>
          </div>
          <div className="hidden items-center gap-2 text-slate-500 text-xs sm:flex">
            <span
              className={`h-2 w-2 rounded-full ${
                serverConfiguredProviders.size > 0
                  ? "bg-emerald-500"
                  : "bg-amber-500"
              }`}
            />
            {serverConfiguredProviders.size > 0
              ? "Controlled developer environment"
              : "自带 Key 体验环境"}
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
              active={modality === "audio"}
              onClick={() => setModality("audio")}
            >
              音频
            </ModalityTab>
          </div>
        </div>
      </header>

      {modality === "image" ? (
        <ImageWorkbench
          models={effectiveModels}
          credentialsMap={credentialsMap}
          serverConfiguredProviders={serverConfiguredProviders}
          onCredentialsChange={handleCredentialsChange}
          onCredentialsClear={handleCredentialsClear}
        />
      ) : null}
      {modality === "video" ? (
        <VideoWorkbench
          models={effectiveModels}
          credentialsMap={credentialsMap}
          serverConfiguredProviders={serverConfiguredProviders}
          onCredentialsChange={handleCredentialsChange}
          onCredentialsClear={handleCredentialsClear}
        />
      ) : null}
      {modality === "audio" ? (
        <AudioWorkbench
          models={effectiveModels}
          credentialsMap={credentialsMap}
          serverConfiguredProviders={serverConfiguredProviders}
          onCredentialsChange={handleCredentialsChange}
          onCredentialsClear={handleCredentialsClear}
        />
      ) : null}

      <footer className="mx-auto max-w-[1440px] px-5 pb-6 text-slate-400 text-xs">
        {serverConfiguredProviders.size > 0
          ? "服务端已配置部分 Provider；也可填写自己的 API Key（填写后优先使用）。自带 Key 仅保存在你的浏览器本地，并随请求转发给服务端代理。Playground 不保存历史结果。"
          : "本环境未配置服务端 API Key，请填写你自己的 Provider API Key 后体验。Key 仅保存在你的浏览器本地，并随请求转发给服务端代理，不会被服务端存储。Playground 不保存历史结果。"}
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
