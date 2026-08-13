import { ThemeSwitcher } from "@workspace/ui/components/custom/theme-switcher";
import { Badge } from "@workspace/ui/components/shadcn/badge";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FaGithub } from "react-icons/fa";
import { Link } from "react-router-dom";

import { LanguageSwitcher } from "@/components/language-switcher";
import { PageContainer } from "@/components/layout/page-container";
import { PROVIDER_LABELS } from "@/lib/key-store";
import { useModelText } from "@/lib/model-text";
import { SITE_MODELS } from "@/lib/playground/registry";
import type { SiteModel } from "@/lib/playground/types";

const REPO_URL = "https://github.com/ecafe8/ai-media-sdk";

/**
 * Landing page: hero, feature highlights, provider/model matrix derived
 * from the SDK registries, privacy statement, and the playground entry.
 */
export function LandingPage() {
  const { t } = useTranslation();

  return (
    <main className="min-h-svh bg-muted/40 text-foreground">
      <header className="border-border border-b bg-card py-4">
        <PageContainer className="flex items-center justify-between">
          <p className="font-semibold text-emerald-600 text-xs uppercase tracking-[0.24em]">
            {t("common.appName")}
          </p>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <ThemeSwitcher
              ariaLabel={t("theme.aria")}
              labels={{
                light: t("theme.light"),
                system: t("theme.system"),
                dark: t("theme.dark"),
              }}
            />
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              aria-label={t("common.github")}
              title={t("common.github")}
              className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:text-foreground"
            >
              <FaGithub className="size-4" />
            </a>
            <Link
              to="playground"
              className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-3.5 font-medium text-sm text-white shadow-sm transition hover:bg-emerald-700"
            >
              {t("landing.enterPlayground")}
            </Link>
          </div>
        </PageContainer>
      </header>

      <section className="py-16">
        <PageContainer className="text-center">
          <Badge variant="secondary" className="mb-4">
            {t("landing.badge")}
          </Badge>
          <h1 className="mx-auto max-w-2xl font-bold text-3xl tracking-tight sm:text-4xl">
            {t("landing.heroTitle")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground text-sm leading-7 sm:text-base">
            {t("landing.heroDescription")}
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              to="playground"
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-sm text-white shadow-sm transition hover:bg-emerald-700"
            >
              {t("landing.tryNow")}
              <ArrowRight className="size-4" />
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-border bg-card px-5 py-2.5 font-medium text-foreground text-sm shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 dark:hover:border-emerald-500/50 dark:hover:text-emerald-400"
            >
              {t("landing.viewDocs")}
            </a>
          </div>
        </PageContainer>
      </section>

      <section className="pb-14">
        <PageContainer>
          <div className="grid gap-4 sm:grid-cols-3">
            <FeatureCard
              title={t("landing.features.image.title")}
              description={t("landing.features.image.description")}
            />
            <FeatureCard
              title={t("landing.features.video.title")}
              description={t("landing.features.video.description")}
            />
            <FeatureCard
              title={t("landing.features.local.title")}
              description={t("landing.features.local.description")}
            />
          </div>
        </PageContainer>
      </section>

      <section className="pb-14">
        <PageContainer>
          <h2 className="mb-4 font-semibold text-lg">
            {t("landing.supportedModels")}
          </h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <ModelMatrix />
          </div>
        </PageContainer>
      </section>

      <section className="pb-16">
        <PageContainer>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-6 py-5">
            <h2 className="font-semibold text-foreground">
              {t("landing.privacy.title")}
            </h2>
            <ul className="mt-3 space-y-2 text-muted-foreground text-sm leading-6">
              <li>· {t("landing.privacy.keys")}</li>
              <li>· {t("landing.privacy.cache")}</li>
              <li>· {t("landing.privacy.temporary")}</li>
              <li>· {t("landing.privacy.autoSave")}</li>
            </ul>
          </div>
        </PageContainer>
      </section>

      <footer className="border-border border-t bg-card py-6">
        <PageContainer className="text-center text-muted-foreground/70 text-xs">
          {t("landing.footerNote", { year: new Date().getFullYear() })}
        </PageContainer>
      </footer>
    </main>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-muted-foreground text-sm leading-6">
        {description}
      </p>
    </div>
  );
}

function capabilityBadges(
  model: SiteModel,
  labels: {
    generate: string;
    edit: string;
    video: string;
    async: string;
  }
): readonly string[] {
  const badges: string[] = [];
  if (model.supportsGenerate) badges.push(labels.generate);
  if (model.supportsEdit) badges.push(labels.edit);
  if (model.supportsVideo) badges.push(labels.video);
  if (model.supportsAsync) badges.push(labels.async);
  return badges;
}

function ModelMatrix() {
  const { t } = useTranslation();
  const modelText = useModelText();
  const providers = [...new Set(SITE_MODELS.map((m) => m.provider))];
  const capabilityLabels = {
    generate: t("landing.capability.generate"),
    edit: t("landing.capability.edit"),
    video: t("landing.capability.video"),
    async: t("landing.capability.async"),
  };
  return (
    <div className="divide-y divide-border/60">
      {providers.map((provider) => {
        const models = SITE_MODELS.filter((m) => m.provider === provider);
        return (
          <div key={provider} className="px-5 py-4">
            <h3 className="mb-2.5 font-medium text-foreground text-sm">
              {PROVIDER_LABELS[provider]}
              <span className="ml-2 text-muted-foreground/70 text-xs">
                {t("landing.modelCount", { count: models.length })}
              </span>
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {models.map((model) => (
                <div
                  key={model.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-foreground text-sm">
                      {modelText(model).label}
                    </p>
                    <p className="truncate font-mono text-muted-foreground/70 text-xs">
                      {model.id}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {capabilityBadges(model, capabilityLabels).map((badge) => (
                      <Badge key={badge} variant="outline" className="text-xs">
                        {badge}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
