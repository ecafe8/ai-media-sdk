/// <reference types="vite/client" />

declare module "*.mdx" {
  import type { ComponentType } from "react";
  import type { MdxComponents } from "@/lib/docs/mdx-types";

  const MDXContent: ComponentType<{ components?: MdxComponents }>;
  export default MDXContent;
  export const frontmatter: unknown;
}

declare module "*.md" {
  import type { ComponentType } from "react";
  import type { MdxComponents } from "@/lib/docs/mdx-types";

  const MDXContent: ComponentType<{ components?: MdxComponents }>;
  export default MDXContent;
  export const frontmatter: unknown;
}
