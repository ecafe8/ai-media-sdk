import { useTranslation } from "react-i18next";

import { SITE_RESOURCES } from "@/lib/i18n";
import { DEFAULT_LANG, isSupportedLang, type SiteLang } from "@/lib/locale";
import type { SiteModel } from "@/lib/playground/types";

/**
 * Localized display text for registry models. Provider and model names stay
 * language-neutral in the registry; descriptive annotations and
 * recommendations are overridden per language from the `models` dictionary
 * section, falling back to the registry values.
 */

export interface ModelOverride {
  readonly label?: string;
  readonly recommendation?: string;
}

export interface ModelDisplayText {
  readonly label: string;
  readonly recommendation: string;
}

export function getModelOverride(
  lang: SiteLang,
  model: Pick<SiteModel, "provider" | "id">
): ModelOverride | undefined {
  const models = SITE_RESOURCES[lang].models as Readonly<
    Record<string, ModelOverride>
  >;
  return models[`${model.provider}:${model.id}`];
}

export function getModelText(
  lang: SiteLang,
  model: SiteModel
): ModelDisplayText {
  const override = getModelOverride(lang, model);
  return {
    label: override?.label ?? model.label,
    recommendation: override?.recommendation ?? model.recommendation,
  };
}

export function useModelText(): (model: SiteModel) => ModelDisplayText {
  const { i18n } = useTranslation();
  const lang = isSupportedLang(i18n.language) ? i18n.language : DEFAULT_LANG;
  return (model) => getModelText(lang, model);
}
