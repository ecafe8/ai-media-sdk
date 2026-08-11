import { describe, expect, test } from "bun:test";

import {
  buildResultFileName,
  isDirectoryPickerSupported,
} from "@/lib/result-storage";

describe("buildResultFileName", () => {
  test("uses the base name when free", () => {
    expect(buildResultFileName(new Set(), "mp4", "20260807-143000")).toBe(
      "result-20260807-143000.mp4"
    );
  });

  test("appends a sequence number on collision", () => {
    const existing = new Set(["result-20260807-143000.mp4"]);
    expect(buildResultFileName(existing, "mp4", "20260807-143000")).toBe(
      "result-20260807-143000-2.mp4"
    );
  });

  test("increments past multiple collisions", () => {
    const existing = new Set([
      "result-20260807-143000.png",
      "result-20260807-143000-2.png",
      "result-20260807-143000-3.png",
    ]);
    expect(buildResultFileName(existing, "png", "20260807-143000")).toBe(
      "result-20260807-143000-4.png"
    );
  });
});

describe("capability detection", () => {
  test("reports unsupported without window/showDirectoryPicker", () => {
    expect(isDirectoryPickerSupported()).toBe(false);
  });
});
