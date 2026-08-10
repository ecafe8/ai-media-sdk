import { Alert, AlertDescription } from "@workspace/ui/components/shadcn/alert";
import { Badge } from "@workspace/ui/components/shadcn/badge";
import { Button } from "@workspace/ui/components/shadcn/button";
import { Separator } from "@workspace/ui/components/shadcn/separator";
import { cn } from "@workspace/ui/lib/utils";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";
import type { UploadedFile } from "@/lib/upload";

function formatExpiry(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildCurlSnippet(
  result: UploadedFile,
  provider: "aliyun" | "google"
): string {
  if (provider === "aliyun") {
    const header = result.requiresHeaders?.["X-DashScope-OssResourceResolve"]
      ? ` -H 'X-DashScope-OssResourceResolve: enable'`
      : "";
    return `curl -X POST https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions \\
 -H "Authorization: Bearer $DASHSCOPE_API_KEY"${header} \\
 -H 'Content-Type: application/json' \\
 -d '{"model":"qwen-vl-plus","messages":[{"role":"user","content":[{"type":"image_url","image_url":{"url":"${result.url}"}}]}]}'`;
  }
  return `# Google Gemini: use result.uri as the file URI in generation calls
file_uri: ${result.url}`;
}

export interface ResultDisplayProps {
  result: UploadedFile;
  provider: "aliyun" | "google";
}

export function ResultDisplay({ result, provider }: ResultDisplayProps) {
  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label}已复制`);
    } catch {
      toast.error("复制失败，请手动选择文本");
    }
  };

  const expiry = formatExpiry(result.expiresAt);
  const curl = buildCurlSnippet(result, provider);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="default">
          {provider === "aliyun" ? "Aliyun" : "Google"}
        </Badge>
        {result.state ? (
          <Badge variant="secondary">{result.state}</Badge>
        ) : null}
        {result.mimeType ? (
          <Badge variant="outline">{result.mimeType}</Badge>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-medium text-muted-foreground text-xs">
          临时 URL
        </span>
        <div className="flex items-start gap-2">
          <code className="flex-1 break-all rounded bg-muted px-2 py-1.5 text-xs">
            {result.url}
          </code>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => copy(result.url, "URL ")}
          >
            <CopyIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {expiry ? (
        <p className="text-muted-foreground text-xs">
          过期时间：{expiry}（48 小时）
        </p>
      ) : null}

      {result.requiresHeaders &&
      Object.keys(result.requiresHeaders).length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-muted-foreground text-xs">
            调用模型时必须携带的请求头
          </span>
          <div className="flex flex-col gap-1">
            {Object.entries(result.requiresHeaders).map(([key, value]) => (
              <code
                key={key}
                className={cn(
                  "break-all rounded bg-amber-500/10 px-2 py-1.5 text-amber-700 text-xs dark:text-amber-400"
                )}
              >
                {key}: {value}
              </code>
            ))}
          </div>
        </div>
      ) : null}

      <Alert>
        <AlertDescription>
          {provider === "aliyun" ? (
            <>
              Aliyun 临时文件是私有的 <code>oss://</code>{" "}
              引用，不能通过拼接协议转换为 HTTP
              下载地址，也不支持查询或下载。它只能在调用模型时使用；如需 HTTP
              URL，请将文件上传到阿里云 OSS 等持久化存储。
            </>
          ) : (
            <>
              Google 文件 URI 只能通过 Gemini API 携带对应 API Key
              使用，不能作为公开 HTTP 下载地址直接访问。文件会在 48
              小时后自动清理；如需长期或公开访问， 请使用 Google Cloud Storage
              等持久化存储。
            </>
          )}
        </AlertDescription>
      </Alert>

      <Separator />

      <div className="flex flex-col gap-1">
        <span className="font-medium text-muted-foreground text-xs">
          调用示例（{provider === "aliyun" ? "curl" : "伪代码"}）
        </span>
        <div className="flex items-start gap-2">
          <pre className="flex-1 overflow-x-auto rounded bg-muted px-2 py-1.5 text-xs leading-relaxed">
            <code>{curl}</code>
          </pre>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => copy(curl, "调用示例 ")}
          >
            <CheckIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
