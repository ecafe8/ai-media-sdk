/**
 * Single structural source of truth for the docs area: group ids plus doc
 * slugs in reading order. Language-neutral — titles live in each doc's
 * frontmatter, group labels resolve via i18n `docs.groups.<id>`, and zh/en
 * content directories mirror this exact slug set.
 */

export type DocGroupId =
  | "gettingStarted"
  | "guides"
  | "providers"
  | "uploader"
  | "faq"
  | "api";

export interface DocGroup {
  /** i18n key segment: resolved as `docs.groups.<id>`. */
  readonly id: DocGroupId;
  /** Doc slugs (path relative to the language dir) in reading order. */
  readonly slugs: readonly string[];
}

export const DOC_GROUPS: readonly DocGroup[] = [
  { id: "gettingStarted", slugs: ["introduction", "quick-start"] },
  {
    id: "guides",
    slugs: [
      "image-generation",
      "video-generation",
      "parameters",
      "results",
      "error-handling",
      "file-upload",
      "audio-generation",
    ],
  },
  {
    id: "providers",
    slugs: [
      "providers/azure-openai",
      "providers/aliyun-bailian",
      "providers/volcengine",
      "providers/minimax",
    ],
  },
  { id: "uploader", slugs: ["uploader"] },
  { id: "faq", slugs: ["faq"] },
  { id: "api", slugs: ["api-reference"] },
];
