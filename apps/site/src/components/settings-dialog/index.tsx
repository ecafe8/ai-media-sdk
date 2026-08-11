import { Badge } from "@workspace/ui/components/shadcn/badge";
import { Button } from "@workspace/ui/components/shadcn/button";
import { Check, KeyRound, ShieldCheck, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

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

const EMPTY_DRAFT: ProviderDraft = {
  apiKey: "",
  endpoint: "",
  apiVersion: "",
  baseUrl: "",
  confirmCustom: false,
};

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { credentials, confirmedHosts } = useKeyStore();
  const [drafts, setDrafts] = useState<Record<SiteProvider, ProviderDraft>>({
    "azure-openai": { ...EMPTY_DRAFT },
    "aliyun-bailian": { ...EMPTY_DRAFT },
    "doubao-seedream": { ...EMPTY_DRAFT },
  });
  const [messages, setMessages] = useState<
    Partial<Record<SiteProvider, { kind: "error" | "success"; text: string }>>
  >({});

  // Sync drafts from the store whenever the dialog opens.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Sync drafts only when the dialog opens; re-syncing on every credential change would overwrite in-progress edits
  useEffect(() => {
    if (!open) return;
    setDrafts({
      "azure-openai": initDraft("azure-openai", credentials),
      "aliyun-bailian": initDraft("aliyun-bailian", credentials),
      "doubao-seedream": initDraft("doubao-seedream", credentials),
    });
    setMessages({});
  }, [open]);

  if (!open) return null;

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
        [provider]: { kind: "error", text: "请填写 API Key" },
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
          text:
            provider === "azure-openai" ? "请填写 Endpoint" : "请填写 Base URL",
        },
      }));
      return;
    }
    if (provider === "azure-openai" && !draft.apiVersion.trim()) {
      setMessages((prev) => ({
        ...prev,
        [provider]: { kind: "error", text: "请填写 API Version" },
      }));
      return;
    }

    if (endpointField.trim()) {
      const validation = validateProviderEndpoint(provider, endpointField);
      if (!validation.ok) {
        setMessages((prev) => ({
          ...prev,
          [provider]: { kind: "error", text: validation.error ?? "端点不可用" },
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
            text: `自定义端点 ${validation.host} 不在默认列表中，请勾选下方确认后保存`,
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
      [provider]: { kind: "success", text: "已保存" },
    }));
  }

  function clear(provider: SiteProvider) {
    clearCredentials(provider);
    setDrafts((prev) => ({ ...prev, [provider]: { ...EMPTY_DRAFT } }));
    setMessages((prev) => ({
      ...prev,
      [provider]: { kind: "success", text: "已清除" },
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
      aria-label="API 设置"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <KeyRound className="size-4" />
            </div>
            <div>
              <h2 className="font-semibold">API 设置</h2>
              <p className="text-slate-500 text-xs">自带 Key，直连 Provider</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭设置"
            className="rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mb-5 flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2.5 text-emerald-800 text-xs leading-5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          <p>
            API Key 仅保存在你的浏览器 localStorage，并只发送给对应的 Provider
            端点，不经过任何中间服务器。同源页面脚本可以读取
            localStorage，请勿在不受信任的设备上使用。
          </p>
        </div>

        <div className="space-y-5">
          {SITE_PROVIDERS.map((provider) => {
            const draft = drafts[provider];
            const message = messages[provider];
            const configured = Boolean(
              credentials[provider]?.apiKey &&
                (provider === "doubao-seedream" ||
                  (provider === "azure-openai"
                    ? credentials[provider]?.endpoint &&
                      credentials[provider]?.apiVersion
                    : credentials[provider]?.baseUrl))
            );
            const customHost = isCustomHost(provider);
            return (
              <div
                key={provider}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-medium text-slate-800 text-sm">
                    {PROVIDER_LABELS[provider]}
                  </h3>
                  {configured ? (
                    <Badge variant="secondary">已配置</Badge>
                  ) : (
                    <Badge variant="outline">未配置</Badge>
                  )}
                </div>

                <div className="grid gap-3">
                  <LabeledInput
                    label="API Key"
                    type="password"
                    value={draft.apiKey}
                    placeholder={
                      provider === "aliyun-bailian"
                        ? "sk-..."
                        : `${PROVIDER_LABELS[provider]} API Key`
                    }
                    onChange={(value) =>
                      updateDraft(provider, { apiKey: value })
                    }
                  />
                  {provider === "azure-openai" ? (
                    <>
                      <LabeledInput
                        label="Endpoint"
                        type="url"
                        value={draft.endpoint}
                        placeholder="https://<resource>.openai.azure.com"
                        onChange={(value) =>
                          updateDraft(provider, { endpoint: value })
                        }
                      />
                      <LabeledInput
                        label="API Version"
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
                          ? "Base URL"
                          : "Base URL（可选）"
                      }
                      type="url"
                      value={draft.baseUrl}
                      placeholder={
                        provider === "aliyun-bailian"
                          ? "https://dashscope.aliyuncs.com/api/v1"
                          : "https://ark.cn-beijing.volces.com/api/v3"
                      }
                      hint={
                        provider === "aliyun-bailian"
                          ? "浏览器直连需 CORS 支持：工作空间端点（*.maas.aliyuncs.com）不可用时，请改用标准端点 https://dashscope.aliyuncs.com/api/v1"
                          : undefined
                      }
                      onChange={(value) =>
                        updateDraft(provider, { baseUrl: value })
                      }
                    />
                  )}

                  {customHost ? (
                    <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 text-xs leading-5">
                      <input
                        type="checkbox"
                        checked={
                          draft.confirmCustom ||
                          confirmedHosts.includes(customHost)
                        }
                        className="mt-0.5 size-3.5"
                        onChange={(event) =>
                          updateDraft(provider, {
                            confirmCustom: event.target.checked,
                          })
                        }
                      />
                      <span>
                        我了解 API Key 将发送到自定义端点{" "}
                        <code className="font-mono">{customHost}</code>
                        ，该地址不在默认 Provider 域名列表中。
                      </span>
                    </label>
                  ) : null}

                  {message ? (
                    <p
                      className={`rounded-lg px-3 py-2 text-sm ${
                        message.kind === "error"
                          ? "bg-red-50 text-red-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {message.text}
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
                      清除
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={() => save(provider)}
                    >
                      <Check className="mr-1 size-3.5" />
                      保存
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
    <label className="block font-medium text-slate-700 text-sm">
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? (
        <span className="mt-1 block font-normal text-slate-400 text-xs leading-4">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
