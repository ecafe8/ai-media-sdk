import type { SiteProvider } from "@/lib/key-store";
import type { SiteLang } from "@/lib/locale";
import { getModelText } from "@/lib/model-text";
import { SITE_MODELS } from "@/lib/playground/registry";
import type { SiteModality, SiteModel } from "@/lib/playground/types";

/**
 * Docs model projection: maps the site model projection (itself derived
 * from the provider package registries, the single source of truth) into a
 * unified doc-facing shape with localized labels. Provider-specific fields
 * (resolutions, ratios, reference caps) are carried as optionals; the table
 * renderer only shows columns present for the provider.
 */

export interface DocModel {
  readonly id: string;
  readonly label: string;
  readonly recommendation: string;
  readonly modality: SiteModality;
  readonly generate: boolean;
  readonly edit: boolean;
  readonly async: boolean;
  readonly supportedSizes?: readonly string[];
  readonly maxResolution?: { readonly width: number; readonly height: number };
  readonly maxN?: number;
  readonly maxEditImages?: number;
  readonly supportedResolutions?: readonly string[];
  readonly supportedAspectRatios?: readonly string[];
  readonly maxReferenceImages?: number;
  readonly maxReferenceVideos?: number;
  readonly maxReferenceAudios?: number;
}

function projectModel(lang: SiteLang, model: SiteModel): DocModel {
  const text = getModelText(lang, model);
  return {
    id: model.id,
    label: text.label,
    recommendation: text.recommendation,
    modality: model.modality,
    generate: model.supportsGenerate,
    edit: model.supportsEdit,
    async: model.supportsAsync === true,
    supportedSizes: model.supportedSizes,
    maxResolution: model.maxResolution,
    maxN: model.maxN,
    maxEditImages: model.maxEditImages,
    supportedResolutions: model.supportedResolutions,
    supportedAspectRatios: model.supportedAspectRatios,
    maxReferenceImages: model.maxReferenceImages,
    maxReferenceVideos: model.maxReferenceVideos,
    maxReferenceAudios: model.maxReferenceAudios,
  };
}

export function projectProviderModels(
  lang: SiteLang,
  provider: SiteProvider
): readonly DocModel[] {
  return SITE_MODELS.filter((model) => model.provider === provider).map(
    (model) => projectModel(lang, model)
  );
}
