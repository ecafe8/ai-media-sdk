import { Input } from "@workspace/ui/components/shadcn/input";
import { KeyRound } from "lucide-react";
import { useId } from "react";

import type {
  PlaygroundCredentials,
  PlaygroundProvider,
} from "@/lib/playground/types";
import { Field } from "../lib/field";

interface CredentialFieldSpec {
  readonly key: keyof PlaygroundCredentials;
  readonly label: string;
  readonly placeholder: string;
  readonly type: "password" | "url" | "text";
  readonly required: boolean;
  readonly hint?: string;
}

/**
 * Per-Provider BYO credential field definitions. Mirrors the server-side
 * resolver's required-field rules so the form and the API stay in sync.
 */
const CREDENTIAL_FIELD_SPECS: Readonly<
  Record<PlaygroundProvider, readonly CredentialFieldSpec[]>
> = {
  "azure-openai": [
    {
      key: "apiKey",
      label: "API Key",
      placeholder: "Azure OpenAI API Key",
      type: "password",
      required: true,
    },
    {
      key: "endpoint",
      label: "Endpoint",
      placeholder: "https://<resource>.cognitiveservices.azure.com",
      type: "url",
      required: true,
    },
    {
      key: "apiVersion",
      label: "API Version",
      placeholder: "2024-02-01",
      type: "text",
      required: true,
    },
  ],
  "aliyun-bailian": [
    {
      key: "apiKey",
      label: "DashScope API Key",
      placeholder: "sk-...",
      type: "password",
      required: true,
    },
    {
      key: "baseUrl",
      label: "Base URL",
      placeholder: "https://<workspace>.cn-beijing.maas.aliyuncs.com/api/v1",
      type: "url",
      required: true,
      hint: "区域化 DashScope 地址，需包含 WorkspaceId 与区域。",
    },
  ],
  volcengine: [
    {
      key: "apiKey",
      label: "Ark API Key",
      placeholder: "Ark API Key",
      type: "password",
      required: true,
    },
    {
      key: "baseUrl",
      label: "Base URL（可选）",
      placeholder: "https://ark.cn-beijing.volces.com/api/v3",
      type: "url",
      required: false,
      hint: "留空时默认使用 cn-beijing 区域。",
    },
  ],
  minimax: [
    {
      key: "apiKey",
      label: "MiniMax API Key",
      placeholder: "MiniMax API Key",
      type: "password",
      required: true,
    },
    {
      key: "baseUrl",
      label: "Base URL（可选）",
      placeholder: "https://api.minimax.io",
      type: "url",
      required: false,
      hint: "留空时默认使用 https://api.minimax.io。",
    },
  ],
};

interface CredentialsPanelProps {
  readonly provider: PlaygroundProvider;
  readonly providerLabel: string;
  readonly configured: boolean;
  readonly credentials: PlaygroundCredentials | undefined;
  readonly onChange: (credentials: PlaygroundCredentials) => void;
  readonly onClear: () => void;
}

/**
 * BYO credentials form for the selected Provider.
 *
 * Renders as a collapsible section. When the Provider is already configured
 * server-side the section is collapsed by default (credentials are optional
 * and take precedence only when filled); when it is not configured the
 * section is expanded and a hint explains the visitor must supply their own
 * key. Values flow up via `onChange`; the shell persists them to
 * `localStorage`.
 */
export function CredentialsPanel({
  provider,
  providerLabel,
  configured,
  credentials,
  onChange,
  onClear,
}: CredentialsPanelProps) {
  const fieldIdPrefix = useId();
  const specs = CREDENTIAL_FIELD_SPECS[provider];

  function setField(key: keyof PlaygroundCredentials, value: string) {
    onChange({ ...(credentials ?? { apiKey: "" }), [key]: value });
  }

  return (
    <details
      open={!configured}
      className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2"
    >
      <summary className="flex cursor-pointer items-center gap-2 font-medium text-slate-700 text-sm">
        <KeyRound className="size-4 text-emerald-600" />
        {configured ? "使用自己的 API Key（优先于服务端）" : "填写你的 API Key"}
      </summary>

      {!configured ? (
        <p className="mt-2 text-amber-700 text-xs leading-5">
          服务端未配置 {providerLabel}
          。请填写你自己的凭证后体验；Key 仅保存在你的浏览器本地。
        </p>
      ) : null}

      <div className="mt-3 grid gap-3">
        {specs.map((spec) => (
          <Field key={spec.key} label={spec.label} required={spec.required}>
            <Input
              id={`${fieldIdPrefix}-${spec.key}`}
              type={spec.type}
              value={credentials?.[spec.key] ?? ""}
              placeholder={spec.placeholder}
              autoComplete="off"
              onChange={(event) => setField(spec.key, event.target.value)}
            />
            {spec.hint ? (
              <p className="mt-1 text-slate-500 text-xs">{spec.hint}</p>
            ) : null}
          </Field>
        ))}
        <button
          type="button"
          className="self-start text-slate-500 text-xs underline-offset-2 transition hover:text-red-600 hover:underline"
          onClick={onClear}
        >
          清除已填写的凭证
        </button>
      </div>
    </details>
  );
}
