export interface PcmFormat {
  readonly sampleRate: number;
  readonly channels: number;
  readonly bitDepth: number;
}

export function base64Bytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function audioUrl(audio: {
  readonly url?: string;
  readonly base64?: string;
  readonly mimeType?: string;
  readonly format?: string;
}): string | undefined {
  if (audio.url) return audio.url;
  if (!audio.base64) return undefined;
  const mime = audio.mimeType ?? (audio.format ? `audio/${audio.format}` : undefined);
  if (!mime || mime === "audio/pcm") return undefined;
  return `data:${mime};base64,${audio.base64}`;
}

export function pcmToWav(bytes: Uint8Array, format: PcmFormat): Blob {
  const blockAlign = format.channels * (format.bitDepth / 8);
  const buffer = new ArrayBuffer(44 + bytes.byteLength);
  const view = new DataView(buffer);
  writeText(view, 0, "RIFF");
  view.setUint32(4, 36 + bytes.byteLength, true);
  writeText(view, 8, "WAVE");
  writeText(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, format.channels, true);
  view.setUint32(24, format.sampleRate, true);
  view.setUint32(28, format.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, format.bitDepth, true);
  writeText(view, 36, "data");
  view.setUint32(40, bytes.byteLength, true);
  new Uint8Array(buffer, 44).set(bytes);
  return new Blob([buffer], { type: "audio/wav" });
}

function writeText(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
