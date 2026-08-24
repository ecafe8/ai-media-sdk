"use client";

import type { AudioContent, AudioStreamEvent } from "@ai-media/sdk";
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
import { AudioLines, Download, LoaderCircle, Play, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PLAYGROUND_PROVIDERS } from "@/lib/playground/registry";
import type {
  PlaygroundCredentials,
  PlaygroundModel,
  PlaygroundProvider,
  PlaygroundResponse,
} from "@/lib/playground/types";
import { CredentialsPanel } from "../credentials-panel";
import {
  isCredentialsComplete,
  normalizeCredentials,
  type StoredCredentialsMap,
} from "../lib/credentials";
import { Field } from "../lib/field";
import {
  audioSource,
  parseSseBlock,
  pcmBase64ChunksToWav,
  pcmBase64ToWav,
  pcmPeaks,
} from "./audio-utils";

interface AudioWorkbenchProps {
  readonly models: readonly PlaygroundModel[];
  readonly credentialsMap: StoredCredentialsMap;
  readonly serverConfiguredProviders: ReadonlySet<PlaygroundProvider>;
  readonly onCredentialsChange: (
    provider: PlaygroundProvider,
    credentials: PlaygroundCredentials
  ) => void;
  readonly onCredentialsClear: (provider: PlaygroundProvider) => void;
}

export function AudioWorkbench({
  models,
  credentialsMap,
  serverConfiguredProviders,
  onCredentialsChange,
  onCredentialsClear,
}: AudioWorkbenchProps) {
  const audioModels = useMemo(
    () => models.filter((model) => model.modality === "audio"),
    [models]
  );
  const first = audioModels.find((model) => model.configured) ?? audioModels[0];
  const [provider, setProvider] = useState<PlaygroundProvider>(
    first?.provider ?? "aliyun-bailian"
  );
  const [modelId, setModelId] = useState(first?.id ?? "");
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("");
  const [format, setFormat] = useState("");
  const [sampleRate, setSampleRate] = useState("");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(0);
  const [volume, setVolume] = useState(1);
  const [ssml, setSsml] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [languageType, setLanguageType] = useState("");
  const [instructions, setInstructions] = useState("");
  const [optimizeInstructions, setOptimizeInstructions] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [result, setResult] = useState<PlaygroundResponse>();
  const [streamUrl, setStreamUrl] = useState<string>();
  const [streamPeaks, setStreamPeaks] = useState<number[]>([]);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | undefined>(undefined);
  const providerModels = audioModels.filter(
    (model) => model.provider === provider
  );
  const current =
    audioModels.find(
      (model) => model.provider === provider && model.id === modelId
    ) ?? providerModels[0];
  const family = current?.family;
  const isQwenAudio = family === "qwen-audio-tts";
  const isQwenTts = family === "qwen-tts";
  const isMiniMax = family === "minimax-tts";
  const formats = current?.supportedFormats ?? [];
  const rates = current?.supportedSampleRates ?? [];

  useEffect(() => {
    if (current && !formats.includes(format)) setFormat(formats[0] ?? "");
    if (current && !rates.includes(Number(sampleRate)))
      setSampleRate(rates[0] ? String(rates[0]) : "");
  }, [current, formats, rates, format, sampleRate]);

  function changeProvider(next: PlaygroundProvider): void {
    const nextModel = audioModels.find((model) => model.provider === next);
    setProvider(next);
    setModelId(nextModel?.id ?? "");
  }

  function options(): Record<string, unknown> {
    if (isQwenTts)
      return {
        ...(languageType ? { languageType } : {}),
        ...(instructions ? { instructions } : {}),
        ...(optimizeInstructions ? { optimizeInstructions: true } : {}),
      };
    if (isMiniMax)
      return {
        voiceSetting: { voiceId: voice, speed: rate, vol: volume, pitch },
        audioSetting: { format, sampleRate: Number(sampleRate) },
      };
    return {
      ...(format ? { format } : {}),
      ...(sampleRate ? { sampleRate: Number(sampleRate) } : {}),
      rate,
      pitch,
      volume,
      ...(ssml ? { enableSsml: true } : {}),
      ...(instruction ? { instruction } : {}),
    };
  }

  async function submit(): Promise<void> {
    if (!text.trim() || !voice.trim()) {
      setError("请输入文本和声音 ID。");
      return;
    }
    if (!current) {
      setError("没有可用的 Alibaba 音频模型。");
      return;
    }
    const credentials = normalizeCredentials(credentialsMap[provider]);
    if (
      !serverConfiguredProviders.has(provider) &&
      !isCredentialsComplete(provider, credentials)
    ) {
      setError("请先填写完整的 API Key 凭证。");
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError("");
    setResult({ status: "processing" });
    setStreamUrl(undefined);
    setStreamPeaks([]);
    const body = {
      provider,
      model: current.id,
      modality: "audio",
      text,
      voice,
      providerOptions: { aliyun: options() },
      ...(credentials ? { credentials } : {}),
    };
    try {
      if (streaming) await stream(body, controller);
      else {
        const response = await fetch("/api/playground/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const payload = (await response.json()) as PlaygroundResponse;
        setResult(
          response.ok
            ? payload
            : {
                status: "failed",
                error: payload.error ?? {
                  code: "UNKNOWN",
                  message: "音频请求失败",
                },
              }
        );
      }
    } catch (caught) {
      if ((caught as Error).name !== "AbortError")
        setResult({
          status: "failed",
          error: {
            code: "NETWORK_ERROR",
            message: "音频服务暂时不可用，请稍后重试。",
          },
        });
    }
  }

  async function stream(
    body: Record<string, unknown>,
    controller: AbortController
  ): Promise<void> {
    const response = await fetch("/api/playground/audio/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error("stream failed");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    const chunks: string[] = [];
    let metadata: AudioContent | undefined;
    while (true) {
      const read = await reader.read();
      if (read.done) break;
      pending += decoder.decode(read.value, { stream: true });
      const blocks = pending.split("\n\n");
      pending = blocks.pop() ?? "";
      for (const block of blocks) {
        const event = parseSseBlock(block) as AudioStreamEvent | undefined;
        if (!event) continue;
        if (event.type === "sentence-synthesis") {
          const audio = event.audio;
          metadata = { ...metadata, ...audio };
          if (audio.base64) {
            chunks.push(audio.base64);
            setStreamPeaks((old) => [
              ...old,
              ...pcmPeaks(audio.base64!, audio.bitDepth ?? 16),
            ]);
          }
        }
        if (event.type === "error") throw new Error(event.message);
        if (event.type === "complete") {
          const audio = event.audio ?? metadata;
          const base64 = audio?.base64;
          if (
            (base64 || chunks.length > 0) &&
            metadata?.sampleRate &&
            metadata.channels &&
            metadata.bitDepth
          ) {
            const url = URL.createObjectURL(
              pcmBase64ChunksToWav(base64 ? [base64] : chunks, {
                sampleRate: metadata.sampleRate,
                channels: metadata.channels,
                bitDepth: metadata.bitDepth,
              })
            );
            setStreamUrl(url);
          }
          setResult({
            status: "succeeded",
            modality: "audio",
            audio: audio ? [audio] : undefined,
            metadata: { provider, model: modelId },
          });
        }
      }
    }
  }

  function stop(): void {
    abortRef.current?.abort();
    setResult(undefined);
  }
  const configured = Boolean(current?.configured);
  return (
    <div className="mx-auto grid max-w-[1440px] gap-5 p-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:p-6">
      <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-2 border-slate-100 border-b pb-4">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
            <AudioLines className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold">音频工作台</h2>
            <p className="text-slate-500 text-xs">{family ?? "未选择模型"}</p>
          </div>
        </div>
        <div className="space-y-5">
          <Field label="Provider">
            <Select
              value={provider}
              items={PLAYGROUND_PROVIDERS.map((item) => ({
                value: item.id,
                label: item.label,
              }))}
              onValueChange={(value) => {
                if (typeof value === "string")
                  changeProvider(value as PlaygroundProvider);
              }}
            >
              <SelectTrigger aria-label="Provider" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {PLAYGROUND_PROVIDERS.map((item) => (
                    <SelectItem
                      key={item.id}
                      value={item.id}
                      disabled={
                        !audioModels.some((model) => model.provider === item.id)
                      }
                    >
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <CredentialsPanel
            key={provider}
            provider={provider}
            providerLabel={
              PLAYGROUND_PROVIDERS.find((item) => item.id === provider)
                ?.label ?? provider
            }
            configured={serverConfiguredProviders.has(provider)}
            credentials={credentialsMap[provider]}
            onChange={(next) => onCredentialsChange(provider, next)}
            onClear={() => onCredentialsClear(provider)}
          />
          <Field label="模型">
            <Select
              value={current?.id ?? modelId}
              items={providerModels.map((item) => ({
                value: item.id,
                label: item.label,
              }))}
              onValueChange={(value) => {
                if (typeof value === "string") setModelId(value);
              }}
            >
              <SelectTrigger aria-label="模型" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {providerModels.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="mt-2 text-slate-500 text-xs">
              {current?.recommendation}
            </p>
          </Field>
          <Field label="文本" required>
            <Textarea
              value={text}
              rows={5}
              placeholder="支持普通文本、SSML 或 LaTeX，原样发送。"
              onChange={(event) => setText(event.target.value)}
            />
          </Field>
          <Field label="声音 ID" required>
            <Input
              value={voice}
              placeholder="longxiaochun_v2"
              onChange={(event) => setVoice(event.target.value)}
            />
          </Field>
          {isQwenAudio || isMiniMax ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="格式">
                <Select
                  value={format}
                  items={formats.map((value) => ({
                    value,
                    label: value.toUpperCase(),
                  }))}
                  onValueChange={(value) => {
                    if (typeof value === "string") setFormat(value);
                  }}
                >
                  <SelectTrigger aria-label="格式">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formats.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="采样率">
                <Select
                  value={sampleRate}
                  items={rates.map((value) => ({
                    value: String(value),
                    label: `${value} Hz`,
                  }))}
                  onValueChange={(value) => {
                    if (typeof value === "string") setSampleRate(value);
                  }}
                >
                  <SelectTrigger aria-label="采样率">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rates.map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        {value} Hz
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          ) : null}
          {isQwenAudio || isMiniMax ? (
            <div className="grid grid-cols-3 gap-2">
              <Field label="语速">
                <Input
                  type="number"
                  step="0.1"
                  value={rate}
                  onChange={(event) => setRate(Number(event.target.value))}
                />
              </Field>
              <Field label="音调">
                <Input
                  type="number"
                  value={pitch}
                  onChange={(event) => setPitch(Number(event.target.value))}
                />
              </Field>
              <Field label="音量">
                <Input
                  type="number"
                  step="0.1"
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                />
              </Field>
            </div>
          ) : null}
          {isQwenAudio ? (
            <>
              <Field label="指令">
                <Input
                  value={instruction}
                  onChange={(event) => setInstruction(event.target.value)}
                />
              </Field>
              <div className="flex items-center gap-2 text-sm">
                <Checkbox
                  aria-label="启用 SSML"
                  checked={ssml}
                  onCheckedChange={(checked) => setSsml(checked === true)}
                />
                启用 SSML
              </div>
            </>
          ) : null}
          {isQwenTts ? (
            <>
              <Field label="语言类型">
                <Input
                  value={languageType}
                  onChange={(event) => setLanguageType(event.target.value)}
                />
              </Field>
              <Field label="Qwen-TTS 指令">
                <Textarea
                  value={instructions}
                  rows={2}
                  onChange={(event) => setInstructions(event.target.value)}
                />
              </Field>
              <div className="flex items-center gap-2 text-sm">
                <Checkbox
                  aria-label="优化指令"
                  checked={optimizeInstructions}
                  onCheckedChange={(checked) =>
                    setOptimizeInstructions(checked === true)
                  }
                />
                优化指令
              </div>
            </>
          ) : null}
          <div className="flex items-center gap-2 text-sm">
            <Checkbox
              aria-label="使用 SSE 流式生成"
              checked={streaming}
              onCheckedChange={(checked) => setStreaming(checked === true)}
            />
            使用 SSE 流式生成
          </div>
          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-red-700 text-sm"
            >
              {error}
            </p>
          ) : null}
          <div className="flex gap-2 border-slate-100 border-t pt-4">
            <Button variant="outline" className="flex-1" onClick={stop}>
              <Square className="mr-2 size-4" />
              停止
            </Button>
            <Button
              className="flex-[2] bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={!configured || result?.status === "processing"}
              onClick={submit}
            >
              {result?.status === "processing" ? (
                <LoaderCircle className="mr-2 size-4 animate-spin" />
              ) : (
                <Play className="mr-2 size-4" />
              )}
              {result?.status === "processing" ? "生成中" : "开始生成"}
            </Button>
          </div>
        </div>
      </aside>
      <AudioResult
        result={result}
        streamUrl={streamUrl}
        peaks={streamPeaks}
        text={text}
      />
    </div>
  );
}

function AudioResult({
  result,
  streamUrl,
  peaks,
  text,
}: {
  readonly result?: PlaygroundResponse;
  readonly streamUrl?: string;
  readonly peaks: readonly number[];
  readonly text: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [decodedPeaks, setDecodedPeaks] = useState<number[]>([]);
  const audio = result?.audio?.[0];
  const [pcmUrl, setPcmUrl] = useState<string>();
  const source =
    streamUrl ?? pcmUrl ?? (audio ? audioSource(audio) : undefined);
  useEffect(() => {
    if (!audio?.base64 || audio.format !== "pcm" || !audio.sampleRate) return;
    const url = URL.createObjectURL(
      pcmBase64ToWav(audio.base64, {
        sampleRate: audio.sampleRate,
        channels: audio.channels ?? 1,
        bitDepth: audio.bitDepth ?? 16,
      })
    );
    setPcmUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audio]);
  useEffect(() => {
    if (!source || peaks.length > 0 || typeof AudioContext === "undefined")
      return;
    let cancelled = false;
    const context = new AudioContext();
    fetch(source)
      .then((response) => response.arrayBuffer())
      .then((buffer) => context.decodeAudioData(buffer))
      .then((decoded) => {
        if (cancelled) return;
        const channel = decoded.getChannelData(0);
        const bucket = Math.max(1, Math.floor(channel.length / 160));
        const next: number[] = [];
        for (let index = 0; index < channel.length; index += bucket) {
          let peak = 0;
          for (
            let sample = index;
            sample < Math.min(index + bucket, channel.length);
            sample += 1
          ) {
            peak = Math.max(peak, Math.abs(channel[sample] ?? 0));
          }
          next.push(peak);
        }
        setDecodedPeaks(next);
      })
      .catch(() => undefined)
      .finally(() => void context.close());
    return () => {
      cancelled = true;
    };
  }, [source, peaks.length]);
  const visiblePeaks = peaks.length > 0 ? peaks : decodedPeaks;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || visiblePeaks.length === 0) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#10b981";
    const width = canvas.width / visiblePeaks.length;
    visiblePeaks.forEach((peak, index) => {
      const height = Math.max(2, peak * canvas.height);
      context.fillRect(
        index * width,
        (canvas.height - height) / 2,
        Math.max(1, width - 1),
        height
      );
    });
  }, [visiblePeaks]);
  if (!result)
    return (
      <section className="flex min-h-[640px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-5 text-center text-slate-500 shadow-sm">
        填写文本和 voice 后生成音频，结果会显示在这里。
      </section>
    );
  return (
    <section
      aria-live="polite"
      className="min-h-[640px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-7"
    >
      <p className="font-semibold text-slate-400 text-xs uppercase tracking-[0.2em]">
        Audio result
      </p>
      <h2 className="mt-1 font-semibold text-lg">
        {result.status === "processing"
          ? "正在合成"
          : result.status === "failed"
            ? "生成失败"
            : "音频生成成功"}
      </h2>
      {result.error ? (
        <p role="alert" className="mt-5 text-red-700">
          {result.error.message}
        </p>
      ) : null}
      {result.status !== "failed" && (source || visiblePeaks.length > 0) ? (
        <div className="mt-6 space-y-4">
          <p className="text-slate-600 text-sm">{text}</p>
          <canvas
            ref={canvasRef}
            width={900}
            height={120}
            aria-label="音频波形"
            className="h-28 w-full rounded-xl bg-slate-950"
          />
          {result.status !== "succeeded" || !source ? null : (
            <>
              {/* Audio is generated speech; the adjacent text is its transcript. */}
              {/* biome-ignore lint/a11y/useMediaCaption: The transcript is rendered immediately above. */}
              <audio
                ref={audioRef}
                controls
                src={source}
                className="w-full"
                onTimeUpdate={(event) => {
                  const element = event.currentTarget;
                  setProgress(
                    element.duration
                      ? element.currentTime / element.duration
                      : 0
                  );
                }}
              />
              <div className="h-1 rounded bg-slate-100">
                <div
                  className="h-1 rounded bg-emerald-500"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <a
                  href={source}
                  download="generated-audio"
                  className="inline-flex items-center rounded-md border px-3 py-2 font-medium text-sm"
                >
                  <Download className="mr-2 size-4" />
                  下载音频
                </a>
                <span className="self-center text-slate-400 text-xs">
                  Provider URL 可能会过期，请及时下载或持久化。
                </span>
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
