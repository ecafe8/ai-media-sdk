import i18n from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";

import {
  DEFAULT_LANG,
  detectInitialLang,
  isSupportedLang,
  type SiteLang,
} from "@/lib/locale";
import enJson from "@/locales/en.json";
import zhJson from "@/locales/zh.json";

/**
 * i18n bootstrap. Dictionaries are statically bundled (the site is small and
 * fully client-rendered), the zh dictionary is the source of truth for key
 * types, and en is structurally checked against it via `DeepStrings`.
 */

type DeepStrings<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : DeepStrings<T[K]>;
};

export const zhResources = zhJson;
export const enResources = enJson satisfies DeepStrings<typeof zhJson>;

export const SITE_RESOURCES = {
  zh: zhResources,
  en: enResources,
} as const;

export type SiteResources = typeof zhJson;

/**
 * Typed dictionary keys for form-schema field labels, e.g. `fields.quality`.
 * Schemas store these keys; the rendering layer resolves them via `t()`.
 */
export type FieldLabelKey = {
  [K in keyof SiteResources["fields"] & string]: `fields.${K}`;
}[keyof SiteResources["fields"] & string];

void i18n.use(initReactI18next).init({
  lng: detectInitialLang(),
  fallbackLng: DEFAULT_LANG,
  supportedLngs: ["zh", "en"],
  resources: {
    zh: { translation: zhResources },
    en: { translation: enResources },
  },
  interpolation: { escapeValue: false },
});

/** Current UI language, falling back to the default for unknown states. */
export function useSiteLang(): SiteLang {
  const { i18n: instance } = useTranslation();
  return isSupportedLang(instance.language) ? instance.language : DEFAULT_LANG;
}

export default i18n;

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      translation: SiteResources;
    };
  }
}
