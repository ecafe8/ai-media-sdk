import { Button } from "@workspace/ui/components/shadcn/button";
import {
  FolderCheck,
  FolderOpen,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SitePlaygroundResponse } from "@/lib/playground/types";
import {
  chooseDirectory,
  clearStoredDirectory,
  getStoredDirectory,
  isDirectoryPickerSupported,
  queryDirectoryPermission,
  requestDirectoryPermission,
  type SaveFailureReason,
  saveResultFile,
  storeDirectory,
} from "@/lib/result-storage";

/**
 * Storage settings shown at the top of the result panel. Before any
 * directory is chosen it warns that provider result URLs are temporary and
 * offers directory selection; after selection, generation results are saved
 * automatically (no per-result click). Unsupported browsers get a
 * Chrome/Edge recommendation and keep generating without auto-save.
 */

type PermissionState = "granted" | "prompt" | "denied";

interface FileSaveStatus {
  readonly saved: boolean;
  readonly fileName?: string;
  readonly failure?: SaveFailureReason;
}

const FAILURE_TEXT: Readonly<Record<SaveFailureReason, string>> = {
  "fetch-failed": "结果 URL 无法被浏览器读取（Provider 未允许跨域下载）",
  permission: "目录授权已失效",
  "write-failed": "写入目录失败",
  unsupported: "当前浏览器不支持目录保存",
};

export function ResultStoragePanel({
  result,
}: {
  readonly result: SitePlaygroundResponse | undefined;
}) {
  const supported = isDirectoryPickerSupported();
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | undefined>(
    undefined
  );
  const [permission, setPermission] = useState<PermissionState>("prompt");
  const [dismissed, setDismissed] = useState(false);
  const [statuses, setStatuses] = useState<readonly FileSaveStatus[]>([]);
  const [busy, setBusy] = useState(false);
  const lastSavedResult = useRef<SitePlaygroundResponse | undefined>(undefined);

  // Restore a persisted directory handle on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await getStoredDirectory();
      if (!stored || cancelled) return;
      setHandle(stored);
      setPermission(await queryDirectoryPermission(stored));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const choose = useCallback(async () => {
    const dir = await chooseDirectory();
    if (!dir) return;
    await storeDirectory(dir);
    setHandle(dir);
    setPermission(await queryDirectoryPermission(dir));
    setDismissed(false);
  }, []);

  const reauthorize = useCallback(async () => {
    if (!handle) return;
    setPermission(await requestDirectoryPermission(handle));
  }, [handle]);

  const revoke = useCallback(async () => {
    await clearStoredDirectory();
    setHandle(undefined);
    setPermission("prompt");
    setStatuses([]);
  }, []);

  // Auto-save each successful result exactly once.
  useEffect(() => {
    if (result?.status !== "succeeded") return;
    if (!handle || permission !== "granted") return;
    if (lastSavedResult.current === result) return;
    lastSavedResult.current = result;

    const urls: { url: string; kind: "image" | "video"; mime?: string }[] = [];
    for (const image of result.images ?? []) {
      if (image.url) {
        urls.push({ url: image.url, kind: "image", mime: image.mimeType });
      }
    }
    for (const video of result.videos ?? []) {
      if (video.url) {
        urls.push({ url: video.url, kind: "video", mime: video.mimeType });
      }
    }
    if (urls.length === 0) return;

    void (async () => {
      setBusy(true);
      const outcomes: FileSaveStatus[] = [];
      for (const item of urls) {
        const outcome = await saveResultFile(
          handle,
          item.url,
          item.kind,
          item.mime
        );
        outcomes.push(outcome);
        if (!outcome.saved && outcome.failure === "permission") {
          setPermission(await queryDirectoryPermission(handle));
        }
      }
      setStatuses(outcomes);
      setBusy(false);
    })();
  }, [result, handle, permission]);

  if (!supported) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-800 text-xs leading-5">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <p>
          当前浏览器不支持自动保存到本地目录，建议使用最新版 Chrome 或 Edge。
          当前仍可生成，但结果仅保留 Provider 临时 URL，可能会过期。
        </p>
      </div>
    );
  }

  if (!handle) {
    if (dismissed) {
      return (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500 text-xs">
          <span>结果仅保留 Provider 临时 URL，可能过期。</span>
          <button
            type="button"
            className="text-emerald-700 underline underline-offset-2"
            onClick={() => void choose()}
          >
            选择目录自动保存
          </button>
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
        <p className="text-slate-600 text-xs leading-5">
          ⚠ 当前结果仅保存在 Provider 临时 URL 中，可能过期。建议选择本地目录，
          生成完成后自动保存。
        </p>
        <div className="mt-2.5 flex gap-2">
          <Button
            type="button"
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => void choose()}
          >
            <FolderOpen className="mr-1.5 size-3.5" />
            选择本地保存目录
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDismissed(true)}
          >
            暂不选择，继续生成
          </Button>
        </div>
      </div>
    );
  }

  if (permission !== "granted") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
        <p className="text-amber-800 text-xs leading-5">
          ⚠ 保存目录「{handle.name}」的授权已失效，自动保存已暂停。
        </p>
        <div className="mt-2.5 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void reauthorize()}
          >
            <RefreshCw className="mr-1.5 size-3.5" />
            重新授权
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void choose()}
          >
            重新选择目录
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <FolderCheck className="size-4 shrink-0 text-emerald-600" />
          <span className="font-medium text-emerald-800">自动保存已启用</span>
          <span className="truncate text-emerald-700/80">📁 {handle.name}</span>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => void choose()}
          >
            更换目录
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => void revoke()}
          >
            取消授权
          </Button>
        </div>
      </div>

      {busy ? (
        <p className="mt-2 text-emerald-700/80 text-xs">正在保存结果…</p>
      ) : null}
      {statuses.length > 0 && !busy ? (
        <ul className="mt-2 space-y-1">
          {statuses.map((status, index) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: Stable prefix (fileName) plus index for collision safety when names repeat or are absent
              key={`${status.fileName ?? "result"}-${index}`}
              className="text-xs"
            >
              {status.saved ? (
                <span className="text-emerald-700">
                  ✓ 已自动保存 {status.fileName}
                </span>
              ) : (
                <span className="text-amber-700">
                  ⚠ 自动保存失败：
                  {FAILURE_TEXT[status.failure ?? "write-failed"]}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
