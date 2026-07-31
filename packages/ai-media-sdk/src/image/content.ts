import type { ImageContent } from "../contracts/content.ts";

/**
 * Normalize image content into a URL that can be used directly by a renderer.
 *
 * Provider URLs take precedence. Base64 content is converted to a data URL
 * using the declared MIME type, defaulting to PNG when the provider omits it.
 */
export function toImageUrl(image: ImageContent): string | undefined {
  if (image.url) return image.url;
  if (!image.base64) return undefined;
  if (image.base64.startsWith("data:")) return image.base64;
  return `data:${image.mimeType ?? "image/png"};base64,${image.base64}`;
}
