import { Button } from "@workspace/ui/components/shadcn/button";
import { Checkbox } from "@workspace/ui/components/shadcn/checkbox";
import { Input } from "@workspace/ui/components/shadcn/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/shadcn/select";
import { Textarea } from "@workspace/ui/components/shadcn/textarea";
import { LoaderCircle, Mic2, Square } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageContainer } from "@/components/layout/page-container";
import {
  executeSiteAudioStream,
  executeSiteRequest,
  executeSiteVoiceCloning,
  executeSiteVoiceDesign,
  uploadSiteAudio,
} from "@/lib/executor";
import type { SiteResources } from "@/lib/i18n";
import {
  PROVIDER_LABELS,
  SITE_PROVIDERS,
  type SiteProvider,
} from "@/lib/key-store";
import { useModelText } from "@/lib/model-text";
import type {
  SiteModel,
  SitePlaygroundResponse,
  SiteVoiceCloningInput,
  SiteVoiceDesignInput,
} from "@/lib/playground/types";
import { base64Bytes, type PcmFormat, pcmPeaks, pcmToWav } from "../lib/audio";
import { Field } from "../lib/field";
import { AudioResult } from "../result-feed";

interface AudioWorkbenchProps {
  readonly models: readonly SiteModel[];
  readonly configuredProviders: ReadonlySet<SiteProvider>;
  readonly onOpenSettings: () => void;
}

type ValidationKey = keyof SiteResources["playground"]["validation"];

export function AudioWorkbench({
  models,
  configuredProviders,
  onOpenSettings,
}: AudioWorkbenchProps) {
  const { t } = useTranslation();
  const modelText = useModelText();
  const audioModels = useMemo(
    () => models.filter((model) => model.modality === "audio"),
    [models]
  );
  const configuredModel = audioModels.find((model) =>
    configuredProviders.has(model.provider)
  );
  const firstModel = configuredModel ?? audioModels[0];
  const [provider, setProvider] = useState<SiteProvider>(
    firstModel?.provider ?? "aliyun-bailian"
  );
  const [modelId, setModelId] = useState(firstModel?.id ?? "");
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamAudio, setStreamAudio] =
    useState<SitePlaygroundResponse["audio"]>(undefined);
  const [streamPeaks, setStreamPeaks] = useState<number[]>([]);
  const [result, setResult] = useState<SitePlaygroundResponse>();
  const [error, setError] = useState<ValidationKey>();
  const abortRef = useRef<AbortController | null>(null);
  const currentModel = audioModels.find(
    (model) => model.provider === provider && model.id === modelId
  );
  const providerModels = audioModels.filter(
    (model) => model.provider === provider
  );
  const family = currentModel?.family;
  const metadata = currentModel?.audio;

  const [values, setValues] = useState<
    Record<string, string | number | boolean>
  >({});
  function setValue(key: string, value: string | number | boolean) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }
  function changeProvider(next: SiteProvider) {
    const nextModel = audioModels.find((model) => model.provider === next);
    setProvider(next);
    setModelId(nextModel?.id ?? "");
    setValues({});
  }
  function changeModel(next: string) {
    setModelId(next);
    setValues({});
  }
  function options():
    | Readonly<Record<string, Record<string, unknown>>>
    | undefined {
    const selected: Record<string, unknown> = {};
    const put = (key: string, target = key) => {
      const value = values[key];
      if (value !== undefined && value !== "" && value !== false)
        selected[target] = value;
    };
    if (family === "qwen-audio-tts") {
      for (const key of [
        "format",
        "sampleRate",
        "rate",
        "pitch",
        "volume",
        "enableSsml",
        "wordTimestampEnabled",
        "instruction",
        "languageHints",
      ])
        put(key);
    } else if (family === "qwen-tts") {
      for (const key of [
        "languageType",
        "instructions",
        "optimizeInstructions",
      ])
        put(key);
    } else if (family === "minimax-tts") {
      for (const key of ["voiceId", "speed", "vol", "pitch", "emotion"])
        put(key, `voiceSetting.${key}`);
      for (const key of [
        "audioFormat",
        "audioSampleRate",
        "bitrate",
        "channel",
      ])
        put(key, `audioSetting.${key.replace("audio", "")}`);
    }
    if (Object.keys(selected).length === 0) return undefined;
    if (family === "minimax-tts") {
      const aliyun: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(selected)) {
        const [group, name] = key.split(".");
        const target =
          group === "voiceSetting" ? "voiceSetting" : "audioSetting";
        const groupOptions =
          (aliyun[target] as Record<string, unknown> | undefined) ?? {};
        aliyun[target] = groupOptions;
        if (name) groupOptions[name] = value;
      }
      return { aliyun };
    }
    return { aliyun: selected };
  }
  async function submit(useStream: boolean) {
    if (!text.trim()) return setError("audioTextRequired");
    if (!voice.trim()) return setError("audioVoiceRequired");
    if (!configuredProviders.has(provider))
      return setError("providerNotConfigured");
    setError(undefined);
    setResult({ status: "processing", modality: "audio" });
    setStreamAudio(undefined);
    setStreamPeaks([]);
    if (useStream) {
      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);
      try {
        const chunks: Uint8Array[] = [];
        let format: PcmFormat | undefined;
        for await (const event of await executeSiteAudioStream({
          provider,
          model: modelId,
          text,
          voice,
          providerOptions: options(),
          signal: controller.signal,
        })) {
          if (event.type === "sentence-synthesis" && event.audio.base64) {
            const chunk = base64Bytes(event.audio.base64);
            chunks.push(chunk);
            format ??= readFormat(
              event.audio,
              metadata?.supportedSampleRates?.[0]
            );
            setStreamAudio([
              { ...event.audio, format: "pcm", mimeType: "audio/pcm" },
            ]);
            setStreamPeaks((previous) => [
              ...previous,
              ...pcmPeaks(chunk, event.audio.bitDepth ?? 16),
            ]);
          }
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "complete" && event.audio) {
            setResult({
              status: "succeeded",
              modality: "audio",
              audio: [event.audio],
            });
          }
        }
        if (chunks.length && format) {
          const bytes = joinBytes(chunks);
          const wav = pcmToWav(bytes, format);
          const url = URL.createObjectURL(wav);
          const completed = {
            url,
            format: "wav",
            mimeType: "audio/wav",
            sampleRate: format.sampleRate,
            channels: format.channels,
            bitDepth: format.bitDepth,
          };
          setStreamAudio([completed]);
          setResult({
            status: "succeeded",
            modality: "audio",
            audio: [completed],
          });
        }
      } catch (streamError) {
        if (!controller.signal.aborted)
          setResult({
            status: "failed",
            error: {
              code: "NETWORK_ERROR",
              message:
                streamError instanceof Error
                  ? streamError.message
                  : "Audio stream failed",
            },
          });
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
      return;
    }
    try {
      setResult(
        await executeSiteRequest({
          provider,
          model: modelId,
          modality: "audio",
          prompt: "",
          text,
          voice,
          providerOptions: options(),
        })
      );
    } catch {
      setResult({
        status: "failed",
        error: { code: "NETWORK_ERROR", message: "Audio generation failed" },
      });
    }
  }
  function reset() {
    abortRef.current?.abort();
    setText("");
    setVoice("");
    setValues({});
    setResult(undefined);
    setStreamAudio(undefined);
    setError(undefined);
    setStreaming(false);
  }

  return (
    <PageContainer className="grid gap-5 py-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:py-6">
      <aside className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-2 border-border/60 border-b pb-4">
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
            <Mic2 className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold">
              {t("playground.audioWorkbench.title")}
            </h2>
            <p className="text-muted-foreground text-xs">
              {t("playground.audioWorkbench.subtitle")}
            </p>
          </div>
        </div>
        <div className="space-y-5">
          <Field label={t("common.provider")}>
            <Select
              value={provider}
              items={SITE_PROVIDERS.map((item) => ({
                value: item,
                label: `${PROVIDER_LABELS[item]}${audioModels.some((model) => model.provider === item) ? "" : t("playground.audioWorkbench.noModels")}`,
              }))}
              onValueChange={(value) => {
                if (typeof value === "string")
                  changeProvider(value as SiteProvider);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {SITE_PROVIDERS.map((item) => (
                    <SelectItem
                      key={item}
                      value={item}
                      disabled={
                        !audioModels.some((model) => model.provider === item)
                      }
                    >
                      {PROVIDER_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("common.model")}>
            <Select
              value={modelId}
              items={providerModels.map((model) => ({
                value: model.id,
                label: modelText(model).label,
              }))}
              onValueChange={(value) => {
                if (typeof value === "string") changeModel(value);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {providerModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {modelText(model).label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="mt-2 text-muted-foreground text-xs">
              {currentModel
                ? modelText(currentModel).recommendation
                : t("playground.audioWorkbench.noModels")}
            </p>
          </Field>
          <Field label={t("playground.audioWorkbench.text")} required>
            <Textarea
              value={text}
              rows={5}
              placeholder={t("playground.audioWorkbench.textPlaceholder")}
              onChange={(event) => setText(event.target.value)}
            />
          </Field>
          <Field label={t("playground.audioWorkbench.voice")} required>
            <Input
              value={voice}
              placeholder={t("playground.audioWorkbench.voicePlaceholder")}
              onChange={(event) => setVoice(event.target.value)}
            />
          </Field>
          {family === "qwen-audio-tts" ? (
            <div className="grid grid-cols-2 gap-3">
              <AudioSelect
                label={t("playground.audioWorkbench.format")}
                value={String(
                  values.format ?? metadata?.supportedFormats?.[0] ?? "wav"
                )}
                options={metadata?.supportedFormats ?? []}
                onChange={(value) => setValue("format", value)}
              />
              <AudioSelect
                label={t("playground.audioWorkbench.sampleRate")}
                value={String(
                  values.sampleRate ??
                    metadata?.supportedSampleRates?.[0] ??
                    24000
                )}
                options={(metadata?.supportedSampleRates ?? []).map(String)}
                onChange={(value) => setValue("sampleRate", Number(value))}
              />
            </div>
          ) : null}
          {family === "qwen-audio-tts" ? (
            <div className="grid grid-cols-3 gap-3">
              <NumberField
                label={t("playground.audioWorkbench.rate")}
                value={values.rate}
                onChange={(value) => setValue("rate", value)}
              />
              <NumberField
                label={t("playground.audioWorkbench.pitch")}
                value={values.pitch}
                onChange={(value) => setValue("pitch", value)}
              />
              <NumberField
                label={t("playground.audioWorkbench.volume")}
                value={values.volume}
                onChange={(value) => setValue("volume", value)}
              />
            </div>
          ) : null}
          {family === "qwen-audio-tts" && metadata?.supportsSsml ? (
            <Check
              label={t("playground.audioWorkbench.ssml")}
              checked={values.enableSsml === true}
              onChange={(checked) => setValue("enableSsml", checked)}
            />
          ) : null}
          {family === "qwen-audio-tts" ? (
            <Field label={t("playground.audioWorkbench.instruction")}>
              <Input
                value={String(values.instruction ?? "")}
                onChange={(event) =>
                  setValue("instruction", event.target.value)
                }
              />
            </Field>
          ) : null}
          {family === "qwen-tts" ? (
            <>
              <Field label={t("playground.audioWorkbench.languageType")}>
                <Input
                  value={String(values.languageType ?? "")}
                  onChange={(event) =>
                    setValue("languageType", event.target.value)
                  }
                />
              </Field>
              <Field label={t("playground.audioWorkbench.instructions")}>
                <Textarea
                  value={String(values.instructions ?? "")}
                  rows={3}
                  onChange={(event) =>
                    setValue("instructions", event.target.value)
                  }
                />
              </Field>
              <Check
                label={t("playground.audioWorkbench.optimizeInstructions")}
                checked={values.optimizeInstructions === true}
                onChange={(checked) =>
                  setValue("optimizeInstructions", checked)
                }
              />
            </>
          ) : null}
          {family === "minimax-tts" ? (
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label={t("playground.audioWorkbench.speed")}
                value={values.speed}
                onChange={(value) => setValue("speed", value)}
              />
              <NumberField
                label={t("playground.audioWorkbench.pitch")}
                value={values.pitch}
                onChange={(value) => setValue("pitch", value)}
              />
              <AudioSelect
                label={t("playground.audioWorkbench.format")}
                value={String(values.audioFormat ?? "mp3")}
                options={metadata?.supportedFormats ?? []}
                onChange={(value) => setValue("audioFormat", value)}
              />
              <AudioSelect
                label={t("playground.audioWorkbench.sampleRate")}
                value={String(
                  values.audioSampleRate ??
                    metadata?.supportedSampleRates?.[0] ??
                    24000
                )}
                options={(metadata?.supportedSampleRates ?? []).map(String)}
                onChange={(value) => setValue("audioSampleRate", Number(value))}
              />
            </div>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-sm"
            >
              {t(`playground.validation.${error}`)}
            </p>
          ) : null}
          <div className="flex gap-2 border-border/60 border-t pt-4">
            <Button variant="outline" className="flex-1" onClick={reset}>
              {t("common.reset")}
            </Button>
            <Button
              className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={streaming}
              onClick={() => submit(false)}
            >
              {t("common.generate")}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                streaming ? abortRef.current?.abort() : submit(true)
              }
            >
              {streaming ? (
                <Square className="size-4" />
              ) : (
                <LoaderCircle className="size-4" />
              )}
            </Button>
          </div>
          {!configuredProviders.has(provider) ? (
            <p className="text-amber-600 text-xs">
              {t("playground.credentialsHint")}{" "}
              <button
                type="button"
                className="underline"
                onClick={onOpenSettings}
              >
                {t("playground.credentialsHintAction")}
              </button>
            </p>
          ) : null}
        </div>
      </aside>
      <section className="min-h-[640px] rounded-2xl border border-border bg-card p-5 shadow-sm lg:p-7">
        <AudioResult
          result={result}
          streamAudio={streamAudio}
          streamPeaks={streamPeaks}
          prompt={text}
          provider={provider}
          model={modelId}
          configured={configuredProviders.has(provider)}
        />
      </section>
      <VoiceResourcePanel
        models={audioModels}
        selectedModel={modelId}
        configured={configuredProviders.has(provider)}
        onVoice={(id) => setVoice(id)}
      />
    </PageContainer>
  );
}

function VoiceResourcePanel({
  models,
  selectedModel,
  configured,
  onVoice,
}: {
  readonly models: readonly SiteModel[];
  readonly selectedModel: string;
  readonly configured: boolean;
  readonly onVoice: (id: string) => void;
}) {
  const { t } = useTranslation();
  const targets = models.filter((model) => model.audio?.voiceResource);
  const [protocol, setProtocol] =
    useState<SiteVoiceCloningInput["protocol"]>("qwen-audio");
  const [targetModel, setTargetModel] = useState(targets[0]?.id ?? "");
  const [audioUrl, setAudioUrl] = useState("");
  const [file, setFile] = useState<File>();
  const [prefix, setPrefix] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [language, setLanguage] = useState("");
  const [voicePrompt, setVoicePrompt] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [sampleRate, setSampleRate] = useState(24000);
  const [responseFormat, setResponseFormat] =
    useState<SiteVoiceDesignInput["responseFormat"]>("mp3");
  const [clones, setClones] = useState<
    readonly { id: string; targetModel?: string }[]
  >([]);
  const [designs, setDesigns] = useState<
    readonly { id: string; targetModel?: string }[]
  >([]);
  const [preview, setPreview] = useState<string>();
  const [message, setMessage] = useState("");

  async function clone(
    operation: "create" | "list" | "get" | "update" | "delete",
    id?: string
  ) {
    try {
      let uploadedUrl = audioUrl.trim() || undefined;
      if (operation === "create" && file)
        uploadedUrl = (await uploadSiteAudio(file, targetModel)).url;
      const result = await executeSiteVoiceCloning(operation, {
        protocol,
        targetModel,
        ...(id ? { id } : {}),
        ...(uploadedUrl ? { audioUrl: uploadedUrl } : {}),
        ...(prefix ? { prefix } : {}),
        ...(preferredName ? { preferredName } : {}),
        ...(language ? { language } : {}),
      });
      if (operation === "list" && "voices" in result) setClones(result.voices);
      if (operation === "create" && "voice" in result && result.voice?.id) {
        if (result.voice.targetModel === selectedModel)
          onVoice(result.voice.id);
        setMessage(
          result.voice.targetModel === selectedModel
            ? t("playground.audioWorkbench.voiceApplied")
            : t("playground.audioWorkbench.voiceModelMismatch")
        );
      } else setMessage(t("playground.audioWorkbench.voiceOperationDone"));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t("playground.audioWorkbench.voiceFailed")
      );
    }
  }
  async function design(
    operation: "create" | "list" | "get" | "delete",
    id?: string
  ) {
    try {
      const result = await executeSiteVoiceDesign(operation, {
        protocol,
        targetModel,
        ...(id ? { id } : {}),
        voicePrompt,
        previewText,
        ...(prefix ? { prefix } : {}),
        ...(preferredName ? { preferredName } : {}),
        ...(language ? { language } : {}),
        sampleRate,
        responseFormat,
      });
      if (operation === "list" && "voices" in result) setDesigns(result.voices);
      if (operation === "create" && "previewAudio" in result) {
        const audio = result.previewAudio;
        setPreview(
          audio?.url ??
            (audio?.base64
              ? `data:${audio.mimeType ?? "audio/mpeg"};base64,${audio.base64}`
              : undefined)
        );
        if (result.voice?.id && result.voice.targetModel === selectedModel)
          onVoice(result.voice.id);
      }
      setMessage(t("playground.audioWorkbench.voiceOperationDone"));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t("playground.audioWorkbench.voiceFailed")
      );
    }
  }
  return (
    <section className="grid gap-5 rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-2 lg:grid-cols-2">
      <div className="space-y-3">
        <h3 className="font-semibold">
          {t("playground.audioWorkbench.cloningTitle")}
        </h3>
        <VoiceFields
          {...{
            protocol,
            setProtocol,
            targetModel,
            setTargetModel,
            targets,
            prefix,
            setPrefix,
            preferredName,
            setPreferredName,
            language,
            setLanguage,
          }}
        />
        <Input
          aria-label={t("playground.audioWorkbench.audioUrl")}
          placeholder="https://.../sample.wav"
          value={audioUrl}
          onChange={(event) => setAudioUrl(event.target.value)}
        />
        <Input
          aria-label={t("playground.audioWorkbench.localAudio")}
          type="file"
          accept="audio/wav,audio/mpeg,audio/mp4"
          onChange={(event) => setFile(event.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-2">
          <Button disabled={!configured} onClick={() => clone("create")}>
            Create
          </Button>
          <Button variant="outline" onClick={() => clone("list")}>
            List
          </Button>
        </div>
        <VoiceList
          items={clones}
          onGet={(id) => clone("get", id)}
          onDelete={(id) => clone("delete", id)}
          onUse={(id) => {
            const item = clones.find((voice) => voice.id === id);
            if (item?.targetModel === selectedModel) onVoice(id);
          }}
        />
      </div>
      <div className="space-y-3">
        <h3 className="font-semibold">
          {t("playground.audioWorkbench.designTitle")}
        </h3>
        <VoiceFields
          {...{
            protocol,
            setProtocol,
            targetModel,
            setTargetModel,
            targets,
            prefix,
            setPrefix,
            preferredName,
            setPreferredName,
            language,
            setLanguage,
          }}
        />
        <Textarea
          aria-label={t("playground.audioWorkbench.voicePrompt")}
          placeholder={t("playground.audioWorkbench.voicePrompt")}
          value={voicePrompt}
          onChange={(event) => setVoicePrompt(event.target.value)}
        />
        <Textarea
          aria-label={t("playground.audioWorkbench.previewText")}
          placeholder={t("playground.audioWorkbench.previewText")}
          value={previewText}
          onChange={(event) => setPreviewText(event.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label={t("playground.audioWorkbench.sampleRate")}
            value={sampleRate}
            onChange={setSampleRate}
          />
          <Input
            aria-label={t("playground.audioWorkbench.responseFormat")}
            value={responseFormat}
            onChange={(event) =>
              setResponseFormat(
                event.target.value as SiteVoiceDesignInput["responseFormat"]
              )
            }
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!configured} onClick={() => design("create")}>
            Create
          </Button>
          <Button variant="outline" onClick={() => design("list")}>
            List
          </Button>
        </div>
        {preview ? (
          // biome-ignore lint/a11y/useMediaCaption: Preview text is shown in the form.
          <audio controls src={preview} className="w-full" />
        ) : null}
        <VoiceList
          items={designs}
          onGet={(id) => design("get", id)}
          onDelete={(id) => design("delete", id)}
          onUse={(id) => {
            const item = designs.find((voice) => voice.id === id);
            if (item?.targetModel === selectedModel) onVoice(id);
          }}
        />
        <p className="text-muted-foreground text-xs">{message}</p>
      </div>
    </section>
  );
}

function VoiceFields({
  protocol,
  setProtocol,
  targetModel,
  setTargetModel,
  targets,
  prefix,
  setPrefix,
  preferredName,
  setPreferredName,
  language,
  setLanguage,
}: {
  protocol: "qwen-audio" | "qwen";
  setProtocol: (value: "qwen-audio" | "qwen") => void;
  targetModel: string;
  setTargetModel: (value: string) => void;
  targets: readonly SiteModel[];
  prefix: string;
  setPrefix: (value: string) => void;
  preferredName: string;
  setPreferredName: (value: string) => void;
  language: string;
  setLanguage: (value: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Select
        value={protocol}
        items={[
          { value: "qwen-audio", label: "qwen-audio" },
          { value: "qwen", label: "qwen" },
        ]}
        onValueChange={(value) => {
          if (value === "qwen" || value === "qwen-audio") setProtocol(value);
        }}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="qwen-audio">qwen-audio</SelectItem>
          <SelectItem value="qwen">qwen</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={targetModel}
        items={targets.map((model) => ({ value: model.id, label: model.id }))}
        onValueChange={(value) => {
          if (typeof value === "string") setTargetModel(value);
        }}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {targets.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              {model.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        placeholder="prefix"
        value={prefix}
        onChange={(event) => setPrefix(event.target.value)}
      />
      <Input
        placeholder="preferred name"
        value={preferredName}
        onChange={(event) => setPreferredName(event.target.value)}
      />
      <Input
        placeholder="language"
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
      />
    </div>
  );
}

function VoiceList({
  items,
  onGet,
  onDelete,
  onUse,
}: {
  items: readonly { id: string; targetModel?: string }[];
  onGet: (id: string) => void;
  onDelete: (id: string) => void;
  onUse: (id: string) => void;
}) {
  return (
    <ul className="space-y-1 text-sm">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-2">
          <span>
            {item.id}{" "}
            <small className="text-muted-foreground">
              {item.targetModel ?? ""}
            </small>
          </span>
          <span className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => onGet(item.id)}>
              Get
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onUse(item.id)}>
              Use
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDelete(item.id)}>
              Delete
            </Button>
          </span>
        </li>
      ))}
    </ul>
  );
}

function AudioSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <Select
        value={value}
        items={options.map((option) => ({ value: option, label: option }))}
        onValueChange={(next) => {
          if (typeof next === "string") onChange(next);
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}
function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | number | boolean | undefined;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        value={value === undefined ? "" : String(value)}
        onChange={(event) => {
          if (event.target.value) onChange(Number(event.target.value));
        }}
      />
    </Field>
  );
}
function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox renders its button control inside the label.
    <label className="flex items-center gap-2 text-sm">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
      />
      {label}
    </label>
  );
}
function joinBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(
    chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  );
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
function readFormat(
  audio: {
    readonly sampleRate?: number;
    readonly channels?: number;
    readonly bitDepth?: number;
  },
  fallback?: number
): PcmFormat | undefined {
  if (!audio.sampleRate && !fallback) return undefined;
  return {
    sampleRate: audio.sampleRate ?? fallback ?? 24000,
    channels: audio.channels ?? 1,
    bitDepth: audio.bitDepth ?? 16,
  };
}
