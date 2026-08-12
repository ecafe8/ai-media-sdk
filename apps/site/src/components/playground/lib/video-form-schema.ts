import type { SiteModel, VideoScenario } from "@/lib/playground/types";

import type { FormOption } from "./image-form-schema";

/**
 * Video form schema helpers.
 *
 * Pure functions that derive dropdown options for video models from the
 * selected model's `supportedResolutions`/`supportedAspectRatios`/
 * `requiresInputVideo`/`videoScenarios` metadata. Used by the VideoWorkbench
 * to render model-aware controls and to seed default values
 * (`options[0].value`). Multi-scenario models (MiniMax-H3) additionally pass
 * the active scenario so option sets can follow per-scenario rules.
 */

/**
 * Default duration options for HappyHorse t2v/i2v/r2v models (3-15 seconds).
 * video-edit hides duration (derived from the source video). Labels are raw
 * counts; the rendering layer localizes them via `fields.seconds`.
 */
const DURATION_OPTIONS: readonly FormOption<number>[] = [
  { value: 3, label: "3" },
  { value: 5, label: "5" },
  { value: 10, label: "10" },
  { value: 15, label: "15" },
];

/**
 * MiniMax-H3 accepts any integer duration from 4 to 15 seconds.
 */
const MINIMAX_DURATION_OPTIONS: readonly FormOption<number>[] = Array.from(
  { length: 12 },
  (_, index) => {
    const value = index + 4;
    return { value, label: String(value) };
  }
);

/**
 * Audio setting values are provider literals; the rendering layer maps the
 * value to a localized label (`fields.audioAuto` / `fields.audioOrigin`).
 */
const AUDIO_SETTING_OPTIONS: readonly FormOption<string>[] = [
  { value: "auto", label: "auto" },
  { value: "origin", label: "origin" },
];

function isMultiScenarioModel(model: SiteModel): boolean {
  return (model.videoScenarios?.length ?? 0) > 1;
}

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
 * Derive the `ratio` dropdown options for the selected video model and
 * (optionally) the active scenario.
 *
 * - i2v (auto-follows first frame) and video-edit (no ratio param) declare
 *   `supportedAspectRatios: []` and the form SHALL hide the ratio control.
 * - Multi-scenario models: text-to-video rejects `adaptive` so it is
 *   filtered out; other scenarios keep the full registry list.
 */
export function videoRatioOptions(
  model: SiteModel,
  scenario?: VideoScenario
): readonly FormOption<string>[] {
  const list = model.supportedAspectRatios ?? [];
  const filtered =
    isMultiScenarioModel(model) && scenario === "t2v"
      ? list.filter((value) => value !== "adaptive")
      : list;
  return filtered.map((value) => ({ value, label: value }));
}

/**
 * Whether the form should render the `ratio` dropdown. False for i2v and
 * video-edit models; for multi-scenario models false only in the i2v
 * scenario (the adapter forces `adaptive`).
 */
export function videoShowsRatio(
  model: SiteModel,
  scenario?: VideoScenario
): boolean {
  if (isMultiScenarioModel(model)) {
    return scenario !== "i2v";
  }
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
 * video-edit; multi-scenario models (MiniMax-H3) have no audio_setting.
 */
export function videoShowsAudioSetting(model: SiteModel): boolean {
  return model.requiresInputVideo === true;
}

/**
 * Derive the `duration` dropdown options for the selected video model.
 * Multi-scenario models (MiniMax-H3) use the full 4-15 second integer range;
 * other models keep the HappyHorse presets.
 */
export function videoDurationOptions(
  model?: SiteModel
): readonly FormOption<number>[] {
  if (model && isMultiScenarioModel(model)) {
    return MINIMAX_DURATION_OPTIONS;
  }
  return DURATION_OPTIONS;
}

export function videoAudioSettingOptions(): readonly FormOption<string>[] {
  return AUDIO_SETTING_OPTIONS;
}
