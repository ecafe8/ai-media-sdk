export interface PcmFormat {
  readonly sampleRate: number;
  readonly channels: number;
  readonly bitDepth: number;
}

export function audioSource(audio: {
  readonly url?: string;
  readonly base64?: string;
  readonly mimeType?: string;
  readonly format?: string;
}): string | undefined {
  if (audio.url) return audio.url;
  if (!audio.base64) return undefined;
  const mime = audio.mimeType ?? `audio/${audio.format ?? "wav"}`;
  return `data:${mime};base64,${audio.base64}`;
}

export function pcmBase64ToWav(base64: string, format: PcmFormat): Blob {
  return pcmBytesToWav(decodeBase64(base64), format);
}

export function pcmBase64ChunksToWav(
  chunks: readonly string[],
  format: PcmFormat
): Blob {
  const decoded = chunks.map(decodeBase64);
  const bytes = new Uint8Array(
    decoded.reduce((size, chunk) => size + chunk.length, 0)
  );
  let offset = 0;
  for (const chunk of decoded) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return pcmBytesToWav(bytes, format);
}

function pcmBytesToWav(bytes: Uint8Array, format: PcmFormat): Blob {
  const blockAlign = format.channels * (format.bitDepth / 8);
  const buffer = new ArrayBuffer(44 + bytes.byteLength);
  const view = new DataView(buffer);
  const write = (offset: number, value: string): void => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + bytes.byteLength, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, format.channels, true);
  view.setUint32(24, format.sampleRate, true);
  view.setUint32(28, format.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, format.bitDepth, true);
  write(36, "data");
  view.setUint32(40, bytes.byteLength, true);
  new Uint8Array(buffer, 44).set(bytes);
  return new Blob([buffer], { type: "audio/wav" });
}

function decodeBase64(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function pcmPeaks(base64: string, bitDepth = 16): number[] {
  const bytes = Uint8Array.from(atob(base64), (character) =>
    character.charCodeAt(0)
  );
  const step = Math.max(1, bitDepth / 8);
  const peaks: number[] = [];
  for (let index = 0; index + step <= bytes.length; index += step * 32) {
    let peak = 0;
    for (
      let sample = index;
      sample + step <= bytes.length && sample < index + step * 32;
      sample += step
    ) {
      const value =
        bitDepth === 16
          ? Math.abs(new DataView(bytes.buffer).getInt16(sample, true)) / 32768
          : Math.abs((bytes[sample] ?? 128) - 128) / 128;
      peak = Math.max(peak, value);
    }
    peaks.push(peak);
  }
  return peaks;
}

export function parseSseBlock(block: string): unknown | undefined {
  const data = block
    .split("\n")
    .find((line) => line.startsWith("data:"))
    ?.slice(5)
    .trim();
  if (!data) return undefined;
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return undefined;
  }
}
