import { Badge } from "@workspace/ui/components/shadcn/badge";
import { Warnings } from "@/components/warnings";
import { ProviderTabs } from "@/components/provider-tabs";

export function App() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Uploader Web</h1>
          <Badge variant="secondary">dev/test-only</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          阿里云 DashScope 与 Google Gemini 临时文件上传测试。选择
          provider，上传本地文件， 获取临时 URL（48h 有效）。
        </p>
      </header>
      <Warnings />
      <ProviderTabs />
      <footer className="text-center text-xs text-muted-foreground">
        API Key 存放在服务端 .env，不会发送到浏览器。
      </footer>
    </div>
  );
}
