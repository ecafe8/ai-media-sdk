import { Badge } from "@workspace/ui/components/shadcn/badge";
import { Button } from "@workspace/ui/components/shadcn/button";
import { Input } from "@workspace/ui/components/shadcn/input";
import {
  ImageOff,
  Link as LinkIcon,
  LoaderCircle,
  UploadCloud,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import {
  formatBytes,
  type ImageSelection,
  validateImageFile,
} from "@/lib/image-input";
import { storeMedia } from "@/lib/media-cache";

/**
 * Single image input combining URL paste and local upload.
 *
 * Selected local files are hashed and cached (`storeMedia`); the component
 * exposes an `ImageSelection` (URL or cache reference), never base64 —
 * encoding is deferred to request construction.
 */

interface ImageSourceFieldProps {
  readonly value: ImageSelection | undefined;
  readonly onChange: (value: ImageSelection | undefined) => void;
  readonly disabled?: boolean;
}

export function ImageSourceField({
  value,
  onChange,
  disabled,
}: ImageSourceFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [urlText, setUrlText] = useState(
    value?.kind === "url" ? value.url : ""
  );
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file || disabled) return;
    const validation = validateImageFile(file);
    if (!validation.ok) {
      setError(validation.error ?? "文件不可用");
      return;
    }
    setError("");
    setUploading(true);
    try {
      const { entry, fromCache } = await storeMedia(file);
      onChange({ kind: "file", hash: entry.hash, entry, fromCache });
      setUrlText("");
    } catch {
      setError("文件处理失败，请重试");
    } finally {
      setUploading(false);
    }
  }

  function handleUrlChange(text: string) {
    setUrlText(text);
    setError("");
    const trimmed = text.trim();
    if (!trimmed) {
      onChange(undefined);
      return;
    }
    onChange({ kind: "url", url: trimmed });
  }

  function remove() {
    onChange(undefined);
    setUrlText("");
    setError("");
  }

  if (value?.kind === "file") {
    const { entry, fromCache } = value;
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-3">
        <div className="flex items-start gap-3">
          {entry.thumb ? (
            <img
              src={entry.thumb}
              alt={entry.name}
              className="size-16 rounded-md border border-border object-cover"
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
              <ImageOff className="size-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground text-sm">
              {entry.name}
            </p>
            <p className="mt-0.5 text-muted-foreground text-xs">
              {formatBytes(entry.size)}
            </p>
            <div className="mt-1.5 flex gap-1.5">
              {fromCache ? (
                <Badge variant="secondary">来自缓存</Badge>
              ) : (
                <Badge variant="secondary">已上传</Badge>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="移除图片"
            className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={remove}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Drag-and-drop zone; the upload button provides the keyboard path
    <div
      className={dragging ? "rounded-lg ring-2 ring-emerald-300" : undefined}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <div className="relative">
        <LinkIcon className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
        <Input
          type="url"
          value={urlText}
          placeholder="粘贴公网图片 URL，或拖拽/选择本地图片"
          disabled={disabled}
          className="pl-9"
          onChange={(event) => handleUrlChange(event.target.value)}
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
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
          上传本地图片
        </Button>
        <span className="text-muted-foreground/70 text-xs">
          ≤5MB，支持 PNG/JPEG/WebP
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/bmp,image/gif"
          className="hidden"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      {error ? (
        <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
