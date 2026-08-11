import type { SiteModel } from "@/lib/playground/types";

import type { FormOption } from "./image-form-schema";

/**
 * Video form schema helpers.
 *
 * Pure functions that derive dropdown options for HappyHorse video modes
 * (t2v/i2v/r2v/video-edit) from the selected model's
 * `supportedResolutions`/`supportedAspectRatios`/`requiresInputVideo`
 * metadata. Used by the VideoWorkbench to render model-aware controls and
 * to seed default values (`options[0].value`).
 */

/**
 * Default duration options for HappyHorse t2v/i2v/r2v models (3-15 seconds).
 * video-edit hides duration (derived from the source video).
 */
const DURATION_OPTIONS: readonly FormOption<number>[] = [
  { value: 3, label: "3 秒" },
  { value: 5, label: "5 秒" },
  { value: 10, label: "10 秒" },
  { value: 15, label: "15 秒" },
];

const AUDIO_SETTING_OPTIONS: readonly FormOption<string>[] = [
  { value: "auto", label: "auto（模型控制）" },
  { value: "origin", label: "origin（保留原声）" },
];

/**
 * Derive the `resolution` dropdown options for the selected video model.
 * Falls back to `["480P","720P","1080P"]` when the registry entry does not
 * declare `supportedResolutions` (defensive; all live entries declare).
 */
export function videoResolutionOptions(
  model: SiteModel
): readonly FormOption<string>[] {
  const list = model.supportedResolutions ?? ["480P", "720P", "1080P"];
  return list.map((value) => ({ value, label: value }));
}

/**
 * Derive the `ratio` dropdown options for the selected video model.
 *
 * - i2v (auto-follows first frame) and video-edit (no ratio param) declare
 *   `supportedAspectRatios: []` and the form SHALL hide the ratio control.
 * - t2v and r2v declare the full HappyHorse ratio list.
 */
export function videoRatioOptions(
  model: SiteModel
): readonly FormOption<string>[] {
  const list = model.supportedAspectRatios ?? [];
  return list.map((value) => ({ value, label: value }));
}

/**
 * Whether the form should render the `ratio` dropdown. False for i2v and
 * video-edit models.
 */
export function videoShowsRatio(model: SiteModel): boolean {
  return (model.supportedAspectRatios?.length ?? 0) > 0;
}

/**
 * Whether the form should render the `duration` dropdown. False for
 * video-edit (duration is derived from the source video).
 */
export function videoShowsDuration(model: SiteModel): boolean {
  return model.requiresInputVideo !== true;
}

/**
 * Whether the form should render the `audio_setting` dropdown. True only for
 * video-edit.
 */
export function videoShowsAudioSetting(model: SiteModel): boolean {
  return model.requiresInputVideo === true;
}

export function videoDurationOptions(): readonly FormOption<number>[] {
  return DURATION_OPTIONS;
}

export function videoAudioSettingOptions(): readonly FormOption<string>[] {
  return AUDIO_SETTING_OPTIONS;
}
