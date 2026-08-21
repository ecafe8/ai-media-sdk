import { ThemeSwitcher } from "@workspace/ui/components/custom/theme-switcher";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { LanguageSwitcher } from "@/components/language-switcher";
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
  const { t } = useTranslation();
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
              {t("common.appName")}
            </p>
            <h1 className="mt-1 font-semibold text-xl tracking-tight">
              {t("playground.title")}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-muted-foreground text-xs sm:flex">
              <span
                className={`h-2 w-2 rounded-full ${
                  anyConfigured ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              {anyConfigured
                ? t("playground.statusConfigured")
                : t("playground.statusUnconfigured")}
            </div>
            <LanguageSwitcher />
            <ThemeSwitcher
              ariaLabel={t("theme.aria")}
              labels={{
                light: t("theme.light"),
                system: t("theme.system"),
                dark: t("theme.dark"),
              }}
            />
            <Link
              to="../docs"
              className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-foreground text-sm shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 dark:hover:border-emerald-500/50 dark:hover:text-emerald-400"
            >
              {t("landing.navDocs")}
            </Link>
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-foreground text-sm shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 dark:hover:border-emerald-500/50 dark:hover:text-emerald-400"
              onClick={() => setSettingsOpen(true)}
            >
              {t("playground.apiSettings")}
            </button>
          </div>
        </PageContainer>
        <PageContainer className="mt-4">
          <div className="inline-flex gap-1 rounded-lg bg-muted p-1 text-sm">
            <ModalityTab
              active={modality === "image"}
              onClick={() => setModality("image")}
            >
              {t("playground.modality.image")}
            </ModalityTab>
            <ModalityTab
              active={modality === "video"}
              onClick={() => setModality("video")}
            >
              {t("playground.modality.video")}
            </ModalityTab>
            <ModalityTab
              active={false}
              disabled
              title={t("common.comingSoon")}
              onClick={() => undefined}
            >
              {t("playground.modality.audio")}
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
          {t("playground.footerNote")}
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
