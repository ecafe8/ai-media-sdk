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
          setError(validation.error ?? "部分文件不可用");
          continue;
        }
        const { entry, fromCache } = await storeMedia(file);
        next.push({ kind: "file", hash: entry.hash, entry, fromCache });
      }
      if (rejected > 0) {
        setError(`最多 ${maxCount} 张参考图，已忽略 ${rejected} 个文件`);
      }
      commit(next);
    } catch {
      setError("文件处理失败，请重试");
    } finally {
      setUploading(false);
    }
  }

  function addSingleUrl() {
    const trimmed = urlText.trim();
    if (!trimmed) return;
    if (!isValidHttpUrl(trimmed)) {
      setError("请输入合法的 http(s) URL");
      return;
    }
    if (atCap) {
      setError(`最多 ${maxCount} 张参考图`);
      return;
    }
    setError("");
    commit([...values, { kind: "url", url: trimmed }]);
    setUrlText("");
  }

  function addBulkUrls() {
    const { valid, invalid } = parseBulkUrls(bulkText);
    if (valid.length === 0) {
      setError("未解析到合法的 http(s) URL");
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
      if (dropped > 0) parts.push(`超出上限，忽略 ${dropped} 个`);
      if (invalid.length > 0) parts.push(`${invalid.length} 个非法 URL 被忽略`);
      setError(parts.join("；"));
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
        <p className="rounded-lg border border-slate-200 border-dashed bg-slate-50 px-3 py-4 text-center text-slate-400 text-sm">
          暂无参考图，顺序即 prompt 中的 [Image N]
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
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-medium text-emerald-700 text-xs">
                {index + 1}
              </span>
              {selection.kind === "file" ? (
                <>
                  {selection.entry.thumb ? (
                    <img
                      src={selection.entry.thumb}
                      alt={selection.entry.name}
                      className="size-12 rounded-md border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex size-12 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400">
                      <ImageOff className="size-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-slate-800 text-sm">
                      {selection.entry.name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="text-slate-500 text-xs">
                        {formatBytes(selection.entry.size)}
                      </span>
                      {selection.fromCache ? (
                        <Badge variant="secondary">来自缓存</Badge>
                      ) : (
                        <Badge variant="secondary">已上传</Badge>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <LinkIcon className="size-4 shrink-0 text-slate-400" />
                  <span className="truncate text-slate-700 text-sm">
                    {selection.url}
                  </span>
                </div>
              )}
              <button
                type="button"
                aria-label={`移除第 ${index + 1} 张`}
                className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                onClick={() => removeAt(index)}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ol>
      )}

      {atCap ? (
        <p className="text-amber-700 text-xs">已达上限（最多 {maxCount} 张）</p>
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
              上传图片
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
            <span className="text-slate-400 text-xs">
              {values.length}/{maxCount}
            </span>
          </div>

          <div className="flex gap-2">
            <Input
              type="url"
              value={urlText}
              placeholder="粘贴单张图片 URL"
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
            className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2"
          >
            <summary className="cursor-pointer text-slate-600 text-sm">
              批量粘贴 URL
            </summary>
            <Textarea
              value={bulkText}
              rows={3}
              placeholder={
                "https://.../1.png, https://.../2.png\n逗号或换行分隔"
              }
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
              解析并添加
            </Button>
          </details>
        </div>
      )}

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
