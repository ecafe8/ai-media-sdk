/**
 * HTTP URL validator shared by the image and video workbenches. Only public
 * `http:` and `https:` URLs are accepted (the API route rejects others).
 */
export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
