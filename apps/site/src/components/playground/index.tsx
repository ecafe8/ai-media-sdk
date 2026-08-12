import { ThemeSwitcher } from "@workspace/ui/components/custom/theme-switcher";
import { useMemo, useState } from "react";

import { PageContainer } from "@/components/layout/page-container";
import { SettingsDialog } from "@/components/settings-dialog";
import { getConfiguredProviders, useKeyStore } from "@/lib/key-store";
import type { SiteModality, SiteModel } from "@/lib/playground/types";
import { ImageWorkbench } from "./image-workbench";
import { VideoWorkbench } from "./video-workbench";

interface PlaygroundProps {
  readonly models: readonly SiteModel[];
}

/**
 * Playground shell: header with BYO environment state, modality tabs
 * (image/video; audio reserved), workbench mounting, and the settings
 * dialog. Credentials come from the global key store.
 */
export function Playground({ models }: PlaygroundProps) {
  const { credentials } = useKeyStore();
  const configuredProviders = useMemo(
    () => getConfiguredProviders(credentials),
    [credentials]
  );

  const [modality, setModality] = useState<SiteModality>(() => {
    const hasConfiguredVideo = models.some(
      (m) => m.modality === "video" && configuredProviders.has(m.provider)
    );
    return hasConfiguredVideo ? "video" : "image";
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const anyConfigured = configuredProviders.size > 0;

  return (
    <main className="min-h-svh bg-muted/40 text-foreground">
      <header className="border-border border-b bg-card py-4">
        <PageContainer className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-emerald-600 text-xs uppercase tracking-[0.24em]">
              AI Media SDK
            </p>
            <h1 className="mt-1 font-semibold text-xl tracking-tight">
              Media Playground
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-muted-foreground text-xs sm:flex">
              <span
                className={`h-2 w-2 rounded-full ${
                  anyConfigured ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              {anyConfigured ? "自带 Key 已配置" : "自带 Key 体验环境"}
            </div>
            <ThemeSwitcher />
            <button
              type="button"
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-foreground text-sm shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 dark:hover:border-emerald-500/50 dark:hover:text-emerald-400"
              onClick={() => setSettingsOpen(true)}
            >
              API 设置
            </button>
          </div>
        </PageContainer>
        <PageContainer className="mt-4">
          <div className="inline-flex gap-1 rounded-lg bg-muted p-1 text-sm">
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
        </PageContainer>
      </header>

      {modality === "image" ? (
        <ImageWorkbench
          models={models}
          configuredProviders={configuredProviders}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : null}
      {modality === "video" ? (
        <VideoWorkbench
          models={models}
          configuredProviders={configuredProviders}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : null}

      <footer className="pb-6">
        <PageContainer className="text-muted-foreground/70 text-xs">
          API Key 仅保存在你的浏览器本地（localStorage），并直接发送给对应
          Provider，不经过任何中间服务器。生成结果为 Provider 临时
          URL，可能过期； 可在生成结果面板选择本地目录自动保存。
        </PageContainer>
      </footer>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
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
          ? "bg-card font-medium shadow-sm"
          : "text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
