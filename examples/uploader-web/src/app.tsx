import { Badge } from "@workspace/ui/components/shadcn/badge";
import { ProviderTabs } from "@/components/provider-tabs";
import { Warnings } from "@/components/warnings";

export function App() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-2xl tracking-tight">Uploader Web</h1>
          <Badge variant="secondary">dev/test-only</Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          阿里云 DashScope 与 Google Gemini 临时文件上传测试。选择
          provider，上传本地文件， 获取临时 URL（48h 有效）。
        </p>
      </header>
      <Warnings />
      <ProviderTabs />
      <footer className="text-center text-muted-foreground text-xs">
        API Key 存放在服务端 .env，不会发送到浏览器。
      </footer>
    </div>
  );
}
