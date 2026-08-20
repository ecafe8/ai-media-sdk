import { useEffect } from "react";

const SITE_NAME = "AI Media SDK";

export interface PageMetadata {
  readonly title?: string;
  readonly description?: string;
  /** Append ` · AI Media SDK` to the title (default true). */
  readonly suffixSiteName?: boolean;
}

/**
 * Syncs `document.title` and `meta[name=description]` with the current
 * page. Every page (landing/playground/docs) calls this, so the last
 * mounted effect always wins and no stale title lingers after navigation.
 */
export function usePageMetadata(metadata: PageMetadata): void {
  const { title, description, suffixSiteName = true } = metadata;

  useEffect(() => {
    if (!title) {
      document.title = SITE_NAME;
      return;
    }
    document.title = suffixSiteName ? `${title} · ${SITE_NAME}` : title;
  }, [title, suffixSiteName]);

  useEffect(() => {
    if (!description) return;
    let meta = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]'
    );
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;
  }, [description]);
}
