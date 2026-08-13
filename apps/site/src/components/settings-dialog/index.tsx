import { Badge } from "@workspace/ui/components/shadcn/badge";
import { Button } from "@workspace/ui/components/shadcn/button";
import { Checkbox } from "@workspace/ui/components/shadcn/checkbox";
import { Input } from "@workspace/ui/components/shadcn/input";
import { Check, KeyRound, ShieldCheck, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  clearCredentials,
  confirmCustomHost,
  PROVIDER_LABELS,
  SITE_PROVIDERS,
  type SiteProvider,
  setCredentials,
  useKeyStore,
  validateProviderEndpoint,
} from "@/lib/key-store";

/**
 * BYO credential settings dialog. Keys persist to localStorage and are sent
 * only to the owning provider endpoint. Custom (non-allowlisted) endpoint
 * hosts require an explicit risk confirmation before saving.
 */

interface SettingsDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

interface ProviderDraft {
  apiKey: string;
  endpoint: string;
  apiVersion: string;
  baseUrl: string;
  confirmCustom: boolean;
}

/**
 * Message keys resolved at render time, so a language switch re-renders
 * pending dialog messages in the new language.
 */
type SettingsMessageKey =
  | "saved"
  | "cleared"
  | "apiKeyRequired"
  | "endpointRequired"
  | "baseUrlRequired"
  | "apiVersionRequired"
  | "endpointInvalid"
  | "customHostNeedsConfirm";

interface SettingsMessage {
  readonly kind: "error" | "success";
  readonly key: SettingsMessageKey;
  readonly host?: string;
}

const EMPTY_DRAFT: ProviderDraft = {
  apiKey: "",
  endpoint: "",
  apiVersion: "",
  baseUrl: "",
  confirmCustom: false,
};

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { t } = useTranslation();
  const { credentials, confirmedHosts } = useKeyStore();
  const [drafts, setDrafts] = useState<Record<SiteProvider, ProviderDraft>>({
    "azure-openai": { ...EMPTY_DRAFT },
    "aliyun-bailian": { ...EMPTY_DRAFT },
    volcengine: { ...EMPTY_DRAFT },
    minimax: { ...EMPTY_DRAFT },
  });
  const [messages, setMessages] = useState<
    Partial<Record<SiteProvider, SettingsMessage>>
  >({});

  // Sync drafts from the store whenever the dialog opens.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Sync drafts only when the dialog opens; re-syncing on every credential change would overwrite in-progress edits
  useEffect(() => {
    if (!open) return;
    setDrafts({
      "azure-openai": initDraft("azure-openai", credentials),
      "aliyun-bailian": initDraft("aliyun-bailian", credentials),
      volcengine: initDraft("volcengine", credentials),
      minimax: initDraft("minimax", credentials),
    });
    setMessages({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Scroll lock: while the dialog is open the page behind it must not
  // scroll, so only the dialog's own scrollbar is visible. The lock is set
  // on the document element, whose overflow always applies to the viewport.
  useEffect(() => {
    if (!open) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  function messageText(message: SettingsMessage): string {
    switch (message.key) {
      case "saved":
        return t("common.saved");
      case "cleared":
        return t("common.cleared");
      case "endpointInvalid":
        return t("settings.endpointInvalid");
      case "customHostNeedsConfirm":
        return t("settings.customHostNeedsConfirm", {
          host: message.host ?? "",
        });
      default:
        return t(`settings.validation.${message.key}`);
    }
  }

  function updateDraft(provider: SiteProvider, patch: Partial<ProviderDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], ...patch },
    }));
    setMessages((prev) => ({ ...prev, [provider]: undefined }));
  }

  function save(provider: SiteProvider) {
    const draft = drafts[provider];
    const apiKey = draft.apiKey.trim();
    if (!apiKey) {
      setMessages((prev) => ({
        ...prev,
        [provider]: { kind: "error", key: "apiKeyRequired" },
      }));
      return;
    }

    const endpointField =
      provider === "azure-openai" ? draft.endpoint : draft.baseUrl;
    const endpointRequired =
      provider === "azure-openai" || provider === "aliyun-bailian";
    if (endpointRequired && !endpointField.trim()) {
      setMessages((prev) => ({
        ...prev,
        [provider]: {
          kind: "error",
          key:
            provider === "azure-openai"
              ? "endpointRequired"
              : "baseUrlRequired",
        },
      }));
      return;
    }
    if (provider === "azure-openai" && !draft.apiVersion.trim()) {
      setMessages((prev) => ({
        ...prev,
        [provider]: { kind: "error", key: "apiVersionRequired" },
      }));
      return;
    }

    if (endpointField.trim()) {
      const validation = validateProviderEndpoint(provider, endpointField);
      if (!validation.ok) {
        setMessages((prev) => ({
          ...prev,
          [provider]: { kind: "error", key: "endpointInvalid" },
        }));
        return;
      }
      if (
        validation.isCustomHost &&
        !draft.confirmCustom &&
        !confirmedHosts.includes(validation.host!)
      ) {
        setMessages((prev) => ({
          ...prev,
          [provider]: {
            kind: "error",
            key: "customHostNeedsConfirm",
            host: validation.host,
          },
        }));
        return;
      }
      if (validation.isCustomHost) {
        confirmCustomHost(validation.host!);
      }
    }

    setCredentials(provider, {
      apiKey,
      ...(provider === "azure-openai"
        ? {
            endpoint: draft.endpoint.trim(),
            apiVersion: draft.apiVersion.trim(),
          }
        : {}),
      ...(provider !== "azure-openai" && draft.baseUrl.trim()
        ? { baseUrl: draft.baseUrl.trim() }
        : {}),
    });
    setMessages((prev) => ({
      ...prev,
      [provider]: { kind: "success", key: "saved" },
    }));
  }

  function clear(provider: SiteProvider) {
    clearCredentials(provider);
    setDrafts((prev) => ({ ...prev, [provider]: { ...EMPTY_DRAFT } }));
    setMessages((prev) => ({
      ...prev,
      [provider]: { kind: "success", key: "cleared" },
    }));
  }

  const isCustomHost = (provider: SiteProvider): string | undefined => {
    const draft = drafts[provider];
    const endpointField =
      provider === "azure-openai" ? draft.endpoint : draft.baseUrl;
    if (!endpointField.trim()) return undefined;
    const validation = validateProviderEndpoint(provider, endpointField);
    return validation.ok && validation.isCustomHost
      ? validation.host
      : undefined;
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Backdrop click-to-close convenience; the dialog's close button provides keyboard access
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t("settings.title")}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="my-8 w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <KeyRound className="size-4" />
            </div>
            <div>
              <h2 className="font-semibold">{t("settings.title")}</h2>
              <p className="text-muted-foreground text-xs">
                {t("settings.subtitle")}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label={t("settings.closeAria")}
            className="rounded p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mb-5 flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-emerald-700 text-xs leading-5 dark:text-emerald-400">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          <p>{t("settings.securityNote")}</p>
        </div>

        <div className="space-y-5">
          {SITE_PROVIDERS.map((provider) => {
            const draft = drafts[provider];
            const message = messages[provider];
            const configured = Boolean(
              credentials[provider]?.apiKey &&
                (provider === "volcengine" ||
                  provider === "minimax" ||
                  (provider === "azure-openai"
                    ? credentials[provider]?.endpoint &&
                      credentials[provider]?.apiVersion
                    : credentials[provider]?.baseUrl))
            );
            const customHost = isCustomHost(provider);
            return (
              <div
                key={provider}
                className="rounded-xl border border-border p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-medium text-foreground text-sm">
                    {PROVIDER_LABELS[provider]}
                  </h3>
                  {configured ? (
                    <Badge variant="secondary">
                      {t("settings.configured")}
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      {t("settings.notConfigured")}
                    </Badge>
                  )}
                </div>

                <div className="grid gap-3">
                  <LabeledInput
                    label="API Key"
                    type="password"
                    value={draft.apiKey}
                    placeholder={
                      provider === "aliyun-bailian"
                        ? t("settings.apiKeyPlaceholder")
                        : t("settings.apiKeyPlaceholderProvider", {
                            provider: PROVIDER_LABELS[provider],
                          })
                    }
                    onChange={(value) =>
                      updateDraft(provider, { apiKey: value })
                    }
                  />
                  {provider === "azure-openai" ? (
                    <>
                      <LabeledInput
                        label={t("settings.endpoint")}
                        type="url"
                        value={draft.endpoint}
                        placeholder="https://<resource>.openai.azure.com"
                        onChange={(value) =>
                          updateDraft(provider, { endpoint: value })
                        }
                      />
                      <LabeledInput
                        label={t("settings.apiVersion")}
                        type="text"
                        value={draft.apiVersion}
                        placeholder="2024-02-01"
                        onChange={(value) =>
                          updateDraft(provider, { apiVersion: value })
                        }
                      />
                    </>
                  ) : (
                    <LabeledInput
                      label={
                        provider === "aliyun-bailian"
                          ? t("settings.baseUrl")
                          : t("settings.baseUrlOptional")
                      }
                      type="url"
                      value={draft.baseUrl}
                      placeholder={
                        provider === "aliyun-bailian"
                          ? "https://dashscope.aliyuncs.com/api/v1"
                          : provider === "minimax"
                            ? "https://api.minimax.io"
                            : "https://ark.cn-beijing.volces.com/api/v3"
                      }
                      hint={
                        provider === "aliyun-bailian"
                          ? t("settings.aliyunBaseUrlHint")
                          : provider === "minimax"
                            ? t("settings.minimaxBaseUrlHint")
                            : undefined
                      }
                      onChange={(value) =>
                        updateDraft(provider, { baseUrl: value })
                      }
                    />
                  )}

                  {customHost ? (
                    // biome-ignore lint/a11y/noLabelWithoutControl: shadcn Checkbox renders a native button control inside the label
                    <label className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-700 text-xs leading-5 dark:text-amber-400">
                      <Checkbox
                        className="mt-0.5"
                        checked={
                          draft.confirmCustom ||
                          confirmedHosts.includes(customHost)
                        }
                        onCheckedChange={(checked) =>
                          updateDraft(provider, {
                            confirmCustom: checked === true,
                          })
                        }
                      />
                      <span>
                        {t("settings.customHostConfirm", {
                          host: customHost,
                        })}
                      </span>
                    </label>
                  ) : null}

                  {message ? (
                    <p
                      className={`rounded-lg px-3 py-2 text-sm ${
                        message.kind === "error"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      {messageText(message)}
                    </p>
                  ) : null}

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => clear(provider)}
                    >
                      <Trash2 className="mr-1 size-3.5" />
                      {t("common.clear")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={() => save(provider)}
                    >
                      <Check className="mr-1 size-3.5" />
                      {t("common.save")}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function initDraft(
  provider: SiteProvider,
  credentials: ReturnType<typeof useKeyStore>["credentials"]
): ProviderDraft {
  const stored = credentials[provider];
  return {
    apiKey: stored?.apiKey ?? "",
    endpoint: stored?.endpoint ?? "",
    apiVersion: stored?.apiVersion ?? "",
    baseUrl: stored?.baseUrl ?? "",
    confirmCustom: false,
  };
}

function LabeledInput({
  label,
  type,
  value,
  placeholder,
  hint,
  onChange,
}: {
  label: string;
  type: "password" | "url" | "text";
  value: string;
  placeholder: string;
  hint?: string;
  onChange: (value: string) => void;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: shadcn Input renders a native input element inside the label
    <label className="block font-medium text-foreground text-sm">
      {label}
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        className="mt-1.5"
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? (
        <span className="mt-1 block font-normal text-muted-foreground/70 text-xs leading-4">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
