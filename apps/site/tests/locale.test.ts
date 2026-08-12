import { afterEach, describe, expect, test } from "bun:test";

import {
  DEFAULT_LANG,
  detectBrowserLang,
  detectInitialLang,
  isSupportedLang,
  readStoredLang,
  SUPPORTED_LANGS,
  storeLang,
} from "@/lib/locale";
import { installMockWindow, uninstallMockWindow } from "./helpers/mock-window";

afterEach(() => {
  uninstallMockWindow();
});

describe("isSupportedLang", () => {
  test("accepts zh and en only", () => {
    expect(isSupportedLang("zh")).toBe(true);
    expect(isSupportedLang("en")).toBe(true);
    expect(isSupportedLang("fr")).toBe(false);
    expect(isSupportedLang("zh-CN")).toBe(false);
    expect(isSupportedLang(undefined)).toBe(false);
    expect(isSupportedLang(42)).toBe(false);
  });

  test("supported langs list matches the default", () => {
    expect(SUPPORTED_LANGS).toEqual(["zh", "en"]);
    expect(SUPPORTED_LANGS).toContain(DEFAULT_LANG);
  });
});

describe("detectBrowserLang", () => {
  test("Chinese primary language resolves to zh", () => {
    expect(detectBrowserLang(["zh-CN", "en-US"])).toBe("zh");
    expect(detectBrowserLang(["zh"])).toBe("zh");
  });

  test("non-Chinese primary languages resolve to en", () => {
    expect(detectBrowserLang(["en-US"])).toBe("en");
    expect(detectBrowserLang(["ja-JP", "zh-CN"])).toBe("en");
    expect(detectBrowserLang([])).toBe("en");
  });
});

describe("locale persistence", () => {
  test("stored choice round-trips through localStorage", () => {
    installMockWindow();
    expect(readStoredLang()).toBeUndefined();
    storeLang("en");
    expect(readStoredLang()).toBe("en");
    storeLang("zh");
    expect(readStoredLang()).toBe("zh");
  });

  test("invalid stored values are ignored", () => {
    installMockWindow();
    window.localStorage.setItem("ai-media-site.lang.v1", "fr");
    expect(readStoredLang()).toBeUndefined();
  });

  test("detectInitialLang prefers the stored choice", () => {
    installMockWindow();
    storeLang("en");
    expect(detectInitialLang()).toBe("en");
  });

  test("detectInitialLang falls back to the default without storage", () => {
    expect(detectInitialLang()).toBe(DEFAULT_LANG);
  });
});
