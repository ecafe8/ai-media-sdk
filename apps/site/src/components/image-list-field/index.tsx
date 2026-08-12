import { Badge } from "@workspace/ui/components/shadcn/badge";
import { Button } from "@workspace/ui/components/shadcn/button";
import { Input } from "@workspace/ui/components/shadcn/input";
import { Textarea } from "@workspace/ui/components/shadcn/textarea";
import {
  ImageOff,
  Link as LinkIcon,
  LoaderCircle,
  Plus,
  UploadCloud,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  formatBytes,
  type ImageSelection,
  isValidHttpUrl,
  parseBulkUrls,
  validateImageFile,
} from "@/lib/image-input";
import { storeMedia } from "@/lib/media-cache";

/**
 * Ordered image list for r2v reference images. Card order maps to the
 * `[Image N]` references in the prompt; additions are blocked at the
 * model's `maxReferenceImages` cap. Supports multi-file upload, single URL
 * add, and bulk URL paste.
 */

interface ImageListFieldProps {
  readonly values: readonly ImageSelection[];
  readonly onChange: (values: readonly ImageSelection[]) => void;
  readonly maxCount: number;
  readonly disabled?: boolean;
}

export function ImageListField({
  values,
  onChange,
  maxCount,
  disabled,
}: ImageListFieldProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [urlText, setUrlText] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const remaining = maxCount - values.length;
  const atCap = remaining <= 0;

  function commit(next: ImageSelection[]) {
    onChange(next.slice(0, maxCount));
  }

  async function handleFiles(files: FileList | null) {
    if (!files || disabled || atCap) return;
    setError("");
    setUploading(true);
    try {
      const next: ImageSelection[] = [...values];
      let rejected = 0;
      for (const file of Array.from(files)) {
        if (next.length >= maxCount) {
          rejected += 1;
          continue;
        }
        const validation = validateImageFile(file);
        if (!validation.ok) {
          setError(
            validation.errorCode === "UNSUPPORTED_TYPE"
              ? t("errors.image.UNSUPPORTED_TYPE")
              : t("errors.image.TOO_LARGE", {
                  max: formatBytes(validation.maxBytes),
                  size: formatBytes(validation.size),
                })
          );
          continue;
        }
        const { entry, fromCache } = await storeMedia(file);
        next.push({ kind: "file", hash: entry.hash, entry, fromCache });
      }
      if (rejected > 0) {
        setError(
          t("playground.imageList.capExceededFiles", {
            count: maxCount,
            dropped: rejected,
          })
        );
      }
      commit(next);
    } catch {
      setError(t("playground.imageList.processingFailed"));
    } finally {
      setUploading(false);
    }
  }

  function addSingleUrl() {
    const trimmed = urlText.trim();
    if (!trimmed) return;
    if (!isValidHttpUrl(trimmed)) {
      setError(t("playground.imageList.invalidUrl"));
      return;
    }
    if (atCap) {
      setError(t("playground.imageList.capReached", { count: maxCount }));
      return;
    }
    setError("");
    commit([...values, { kind: "url", url: trimmed }]);
    setUrlText("");
  }

  function addBulkUrls() {
    const { valid, invalid } = parseBulkUrls(bulkText);
    if (valid.length === 0) {
      setError(t("playground.imageList.bulkNoneParsed"));
      return;
    }
    const room = maxCount - values.length;
    const accepted = valid.slice(0, room);
    const dropped = valid.length - accepted.length;
    setError("");
    commit([
      ...values,
      ...accepted.map((url) => ({ kind: "url", url }) as ImageSelection),
    ]);
    setBulkText("");
    if (dropped > 0 || invalid.length > 0) {
      const parts: string[] = [];
      if (dropped > 0) {
        parts.push(t("playground.imageList.bulkDropped", { count: dropped }));
      }
      if (invalid.length > 0) {
        parts.push(
          t("playground.imageList.bulkInvalid", { count: invalid.length })
        );
      }
      setError(parts.join("; "));
    }
  }

  function removeAt(index: number) {
    const next = [...values];
    next.splice(index, 1);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {values.length === 0 ? (
        <p className="rounded-lg border border-border border-dashed bg-muted/50 px-3 py-4 text-center text-muted-foreground/70 text-sm">
          {t("playground.imageList.empty")}
        </p>
      ) : (
        <ol className="space-y-2">
          {values.map((selection, index) => (
            <li
              key={
                selection.kind === "file"
                  ? selection.hash
                  : `${selection.url}-${index}`
              }
              className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-2.5"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 font-medium text-emerald-700 text-xs dark:text-emerald-400">
                {index + 1}
              </span>
              {selection.kind === "file" ? (
                <>
                  {selection.entry.thumb ? (
                    <img
                      src={selection.entry.thumb}
                      alt={selection.entry.name}
                      className="size-12 rounded-md border border-border object-cover"
                    />
                  ) : (
                    <div className="flex size-12 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
                      <ImageOff className="size-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-foreground text-sm">
                      {selection.entry.name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="text-muted-foreground text-xs">
                        {formatBytes(selection.entry.size)}
                      </span>
                      {selection.fromCache ? (
                        <Badge variant="secondary">
                          {t("common.fromCache")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          {t("common.uploaded")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <LinkIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-foreground text-sm">
                    {selection.url}
                  </span>
                </div>
              )}
              <button
                type="button"
                aria-label={t("playground.imageList.removeItem", {
                  count: index + 1,
                })}
                className="shrink-0 rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                onClick={() => removeAt(index)}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ol>
      )}

      {atCap ? (
        <p className="text-amber-600 text-xs dark:text-amber-400">
          {t("playground.imageList.atCap", { count: maxCount })}
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <LoaderCircle className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <UploadCloud className="mr-1.5 size-3.5" />
              )}
              {t("playground.imageList.upload")}
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/bmp,image/gif"
              className="hidden"
              onChange={(event) => {
                handleFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <span className="text-muted-foreground/70 text-xs">
              {values.length}/{maxCount}
            </span>
          </div>

          <div className="flex gap-2">
            <Input
              type="url"
              value={urlText}
              placeholder={t("playground.imageList.singleUrlPlaceholder")}
              disabled={disabled}
              onChange={(event) => setUrlText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSingleUrl();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || !urlText.trim()}
              onClick={addSingleUrl}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>

          <details
            open={bulkOpen}
            onToggle={(event) =>
              setBulkOpen((event.currentTarget as HTMLDetailsElement).open)
            }
            className="rounded-lg border border-border bg-muted/50 px-3 py-2"
          >
            <summary className="cursor-pointer text-muted-foreground text-sm">
              {t("playground.imageList.bulkSummary")}
            </summary>
            <Textarea
              value={bulkText}
              rows={3}
              placeholder={t("playground.imageList.bulkPlaceholder")}
              disabled={disabled}
              className="mt-2 resize-y"
              onChange={(event) => setBulkText(event.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={disabled || !bulkText.trim()}
              onClick={addBulkUrls}
            >
              {t("playground.imageList.bulkAdd")}
            </Button>
          </details>
        </div>
      )}

      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
