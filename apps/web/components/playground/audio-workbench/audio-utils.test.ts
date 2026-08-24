import { describe, expect, test } from "bun:test";
import {
  audioSource,
  parseSseBlock,
  pcmBase64ChunksToWav,
  pcmBase64ToWav,
  pcmPeaks,
} from "./audio-utils";

describe("audio workbench utilities", () => {
  test("creates MIME-aware sources for URL and base64 audio", () => {
    expect(audioSource({ url: "https://example.test/a.mp3" })).toBe(
      "https://example.test/a.mp3"
    );
    expect(audioSource({ base64: "AQI=", format: "wav" })).toBe(
      "data:audio/wav;base64,AQI="
    );
  });

  test("wraps PCM bytes in a WAV container without assigning raw PCM", () => {
    const wav = pcmBase64ToWav("AAAA", {
      sampleRate: 24000,
      channels: 1,
      bitDepth: 16,
    });
    expect(wav.type).toBe("audio/wav");
    expect(wav.size).toBe(47);
    expect(
      pcmBase64ChunksToWav(["AA==", "AA=="], {
        sampleRate: 24000,
        channels: 1,
        bitDepth: 16,
      }).size
    ).toBe(46);
  });

  test("accumulates PCM peaks and parses SSE data", () => {
    expect(pcmPeaks("////", 16)).toEqual([0.000030517578125]);
    expect(parseSseBlock('event: complete\ndata: {"type":"complete"}')).toEqual(
      { type: "complete" }
    );
    expect(parseSseBlock("data: not-json")).toBeUndefined();
  });
});
