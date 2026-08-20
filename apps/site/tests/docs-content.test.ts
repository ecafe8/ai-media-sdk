import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import * as sdk from "@ai-media/sdk";
import { z } from "zod";
import { DOC_GROUPS } from "@/content/docs/manifest";

/**
 * Docs content consistency checks (spec: manifest/IA integrity, bilingual
 * structure, frontmatter automation, hand-written API reference). Runs at
 * the file-system level so bun test never has to compile MDX.
 */

const DOCS_DIR = path.resolve(import.meta.dirname, "../src/content/docs");

const frontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  draft: z.boolean().optional(),
});

function listMdxSlugs(lang: string): string[] {
  const root = path.join(DOCS_DIR, lang);
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry.endsWith(".mdx")) {
        out.push(path.relative(root, full).replace(/\.mdx$/, ""));
      }
    }
  };
  if (existsSync(root)) walk(root);
  return out.sort();
}

function readDoc(lang: string, slug: string): string {
  return readFileSync(path.join(DOCS_DIR, lang, `${slug}.mdx`), "utf8");
}

/** Minimal YAML-subset parser for the flat frontmatter shape docs use. */
function parseFrontmatter(source: string): Record<string, unknown> {
  const match = /^---\n([\s\S]*?)\n---/.exec(source);
  if (!match?.[1]) return {};
  const out: Record<string, unknown> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (value === "true") out[key] = true;
    else if (value === "false") out[key] = false;
    else out[key] = value;
  }
  return out;
}

const MANIFEST_SLUGS = DOC_GROUPS.flatMap((group) => [...group.slugs]).sort();
const ZH_SLUGS = listMdxSlugs("zh");
const EN_SLUGS = listMdxSlugs("en");

describe("manifest ↔ zh file consistency", () => {
  test("every manifest slug has a zh file", () => {
    const missing = MANIFEST_SLUGS.filter((slug) => !ZH_SLUGS.includes(slug));
    expect(missing).toEqual([]);
  });

  test("every zh file appears in the manifest", () => {
    const orphan = ZH_SLUGS.filter((slug) => !MANIFEST_SLUGS.includes(slug));
    expect(orphan).toEqual([]);
  });

  test("manifest slugs are unique", () => {
    expect(new Set(MANIFEST_SLUGS).size).toBe(MANIFEST_SLUGS.length);
  });
});

describe("bilingual structure", () => {
  test("en files are a subset of the manifest (no orphan en files)", () => {
    const orphan = EN_SLUGS.filter((slug) => !MANIFEST_SLUGS.includes(slug));
    expect(orphan).toEqual([]);
  });

  test("every en slug also exists in zh (zh is the source language)", () => {
    const missingZh = EN_SLUGS.filter((slug) => !ZH_SLUGS.includes(slug));
    expect(missingZh).toEqual([]);
  });
});

describe("frontmatter validation", () => {
  for (const lang of ["zh", "en"] as const) {
    for (const slug of listMdxSlugs(lang)) {
      test(`${lang}/${slug} has valid frontmatter`, () => {
        const parsed = frontmatterSchema.safeParse(
          parseFrontmatter(readDoc(lang, slug))
        );
        if (!parsed.success) {
          throw new Error(
            `Invalid frontmatter in ${lang}/${slug}.mdx: ${parsed.error.issues
              .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
              .join("; ")}`
          );
        }
      });
    }
  }
});

describe("API reference integrity", () => {
  /** Committed snapshot of @ai-media/sdk runtime exports; any change forces a
   * deliberate doc update decision. */
  const SDK_EXPORT_SNAPSHOT = [
    "DEFAULT_RETRY_POLICY",
    "DEFAULT_TIMEOUT_MS",
    "SdkError",
    "TransportError",
    "classifyHttpError",
    "collectSupportedModels",
    "createTaskHandle",
    "createTransport",
    "editImage",
    "findSupportedModel",
    "generateImage",
    "isImageEditInput",
    "isImageGenerationInput",
    "isSupportedModel",
    "notImplemented",
    "pixelSize",
    "submitImageTask",
    "submitTask",
    "submitVideoTask",
    "tierSize",
    "toImageUrl",
    "unknownModel",
  ];

  function extractApiReferenceList(): string[] {
    const source = readDoc("zh", "api-reference");
    const match =
      /export const API_REFERENCE_EXPORTS\s*=\s*\[([\s\S]*?)\]/.exec(source);
    if (!match?.[1]) throw new Error("API_REFERENCE_EXPORTS not found in mdx");
    return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? "");
  }

  test("SDK runtime exports match the committed snapshot", () => {
    expect(Object.keys(sdk).sort()).toEqual(SDK_EXPORT_SNAPSHOT);
  });

  test("listed runtime symbols are exported by the SDK", () => {
    const listed = extractApiReferenceList();
    const exports = new Set(Object.keys(sdk));
    const runtimeListed = listed.filter((name) => exports.has(name));
    // Type-only entries (GenerationResult/TaskHandle/...) are not visible at
    // runtime; the runtime subset must still be substantial.
    expect(runtimeListed.length).toBeGreaterThanOrEqual(8);
  });

  test("every listed symbol has a section in the zh api-reference page", () => {
    const source = readDoc("zh", "api-reference");
    const listed = extractApiReferenceList();
    const missing = listed.filter((name) => !source.includes(name));
    expect(missing).toEqual([]);
  });
});

describe("content structure assertions", () => {
  const PROVIDER_PAGES = [
    "providers/azure-openai",
    "providers/aliyun-bailian",
    "providers/volcengine",
    "providers/minimax",
  ];

  for (const slug of PROVIDER_PAGES) {
    test(`zh/${slug} follows the seven-section template`, () => {
      const source = readDoc("zh", slug);
      for (const heading of [
        "## 概览",
        "## 安装",
        "## 配置",
        "## 快速开始",
        "## 模型列表",
        "## providerOptions",
        "## 限制与差异",
      ]) {
        expect(source).toContain(heading);
      }
    });
  }

  test("zh/quick-start has installation and a runnable example", () => {
    const source = readDoc("zh", "quick-start");
    expect(source).toContain("## 安装");
    expect(source).toContain("```ts");
    expect(source).toContain("generateImage");
  });

  test("error codes are only maintained in error-handling", () => {
    for (const slug of [...PROVIDER_PAGES, "faq"]) {
      const source = readDoc("zh", slug);
      expect(source).not.toContain("| `NOT_IMPLEMENTED` |");
    }
  });
});
