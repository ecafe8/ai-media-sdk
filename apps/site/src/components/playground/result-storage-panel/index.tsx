import { Button } from "@workspace/ui/components/shadcn/button";
import {
  FolderCheck,
  FolderOpen,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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

const FAILURE_KEYS: Readonly<
  Record<
    SaveFailureReason,
    "fetchFailed" | "permission" | "writeFailed" | "unsupported"
  >
> = {
  "fetch-failed": "fetchFailed",
  permission: "permission",
  "write-failed": "writeFailed",
  unsupported: "unsupported",
};

export function ResultStoragePanel({
  result,
}: {
  readonly result: SitePlaygroundResponse | undefined;
}) {
  const { t } = useTranslation();
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
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-amber-700 text-xs leading-5 dark:text-amber-400">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <p>{t("storage.unsupported")}</p>
      </div>
    );
  }

  if (!handle) {
    if (dismissed) {
      return (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-3 py-2 text-muted-foreground text-xs">
          <span>{t("storage.dismissedNote")}</span>
          <button
            type="button"
            className="text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
            onClick={() => void choose()}
          >
            {t("storage.dismissedAction")}
          </button>
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-border bg-muted/50 px-3 py-3">
        <p className="text-muted-foreground text-xs leading-5">
          {t("storage.chooseNote")}
        </p>
        <div className="mt-2.5 flex gap-2">
          <Button
            type="button"
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => void choose()}
          >
            <FolderOpen className="mr-1.5 size-3.5" />
            {t("storage.chooseAction")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDismissed(true)}
          >
            {t("storage.chooseSkip")}
          </Button>
        </div>
      </div>
    );
  }

  if (permission !== "granted") {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3">
        <p className="text-amber-700 text-xs leading-5 dark:text-amber-400">
          {t("storage.permissionNote", { name: handle.name })}
        </p>
        <div className="mt-2.5 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void reauthorize()}
          >
            <RefreshCw className="mr-1.5 size-3.5" />
            {t("storage.reauthorize")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void choose()}
          >
            {t("storage.rechoose")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <FolderCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium text-emerald-700 dark:text-emerald-400">
            {t("storage.enabled")}
          </span>
          <span className="truncate text-emerald-700/80 dark:text-emerald-400/80">
            📁 {handle.name}
          </span>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => void choose()}
          >
            {t("storage.changeDir")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => void revoke()}
          >
            {t("storage.revoke")}
          </Button>
        </div>
      </div>

      {busy ? (
        <p className="mt-2 text-emerald-700/80 text-xs dark:text-emerald-400/80">
          {t("storage.saving")}
        </p>
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
                <span className="text-emerald-700 dark:text-emerald-400">
                  {t("storage.savedItem", { name: status.fileName ?? "" })}
                </span>
              ) : (
                <span className="text-amber-700 dark:text-amber-400">
                  {t("storage.failedItem", {
                    reason: t(
                      `storage.failures.${FAILURE_KEYS[status.failure ?? "write-failed"]}`
                    ),
                  })}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
