import { describe, expect, test } from "bun:test";

import {
  readMiniMaxVideoConfig,
  readMiniMaxVideoExampleInputs,
  readMiniMaxVideoModels,
  readMiniMaxVideoOptions,
} from "../src/config.js";

describe("MiniMax video example configuration", () => {
  test("reports missing variables without making a request", () => {
    expect(() => readMiniMaxVideoConfig({})).toThrow("MINIMAX_API_KEY");
  });

  test("uses the MiniMax-H3 model by default", () => {
    expect(readMiniMaxVideoModels({})).toEqual(["MiniMax-H3"]);
  });

  test("parses a comma-separated video model list", () => {
    expect(
      readMiniMaxVideoModels({ MINIMAX_VIDEO_MODEL: "MiniMax-H3, other" })
    ).toEqual(["MiniMax-H3", "other"]);
  });

  test("builds a config from environment values with optional base URL", () => {
    expect(readMiniMaxVideoConfig({ MINIMAX_API_KEY: "test-key" })).toEqual({
      apiKey: "test-key",
    });
    expect(
      readMiniMaxVideoConfig({
        MINIMAX_API_KEY: "test-key",
        MINIMAX_BASE_URL: "https://proxy.example.com",
      })
    ).toEqual({
      apiKey: "test-key",
      baseUrl: "https://proxy.example.com",
    });
  });

  test("reads example inputs for i2v and r2v scenarios", () => {
    expect(readMiniMaxVideoExampleInputs({})).toEqual({
      firstFrameUrl: undefined,
      lastFrameUrl: undefined,
      referenceImageUrls: [],
      referenceVideoUrls: [],
      referenceAudioUrls: [],
    });
    expect(
      readMiniMaxVideoExampleInputs({
        MINIMAX_FIRST_FRAME_URL: "https://x/first.png",
        MINIMAX_LAST_FRAME_URL: "https://x/last.png",
        MINIMAX_REFERENCE_IMAGE_URLS: "https://x/a.png, https://x/b.png",
        MINIMAX_REFERENCE_VIDEO_URLS: "https://x/v.mp4",
        MINIMAX_REFERENCE_AUDIO_URLS: "https://x/a.mp3",
      })
    ).toEqual({
      firstFrameUrl: "https://x/first.png",
      lastFrameUrl: "https://x/last.png",
      referenceImageUrls: ["https://x/a.png", "https://x/b.png"],
      referenceVideoUrls: ["https://x/v.mp4"],
      referenceAudioUrls: ["https://x/a.mp3"],
    });
  });

  test("defaults resolution and duration", () => {
    expect(readMiniMaxVideoOptions({})).toEqual({
      resolution: "2K",
      duration: 5,
    });
  });

  test("parses and validates native options", () => {
    expect(
      readMiniMaxVideoOptions({
        MINIMAX_RESOLUTION: "768P",
        MINIMAX_DURATION: "10",
        MINIMAX_RATIO: "9:16",
      })
    ).toEqual({ resolution: "768P", duration: 10, ratio: "9:16" });
    expect(() => readMiniMaxVideoOptions({ MINIMAX_RESOLUTION: "4K" })).toThrow(
      "MINIMAX_RESOLUTION"
    );
    expect(() => readMiniMaxVideoOptions({ MINIMAX_DURATION: "3" })).toThrow(
      "MINIMAX_DURATION"
    );
  });
});
