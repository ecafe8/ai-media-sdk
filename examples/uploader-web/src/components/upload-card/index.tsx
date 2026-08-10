import { Button } from "@workspace/ui/components/shadcn/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/shadcn/card";
import { Input } from "@workspace/ui/components/shadcn/input";
import { Label } from "@workspace/ui/components/shadcn/label";
import { Loader2Icon, UploadIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FilePicker } from "@/components/file-picker";
import { ResultDisplay } from "@/components/result-display";
import {
  UploadClientError,
  type UploadedFile,
  uploadToAliyun,
  uploadToGoogle,
} from "@/lib/upload";

export interface UploadCardProps {
  provider: "aliyun" | "google";
}

export function UploadCard({ provider }: UploadCardProps) {
  const isAliyun = provider === "aliyun";
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState("qwen-image-2.0-pro");
  const [mimeType, setMimeType] = useState("image/png");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadedFile | null>(null);

  const canSubmit =
    !loading &&
    file !== null &&
    (isAliyun ? model.trim().length > 0 : mimeType.trim().length > 0);

  async function handleSubmit() {
    if (!file || !canSubmit) return;
    setLoading(true);
    setResult(null);
    const toastId = toast.loading(
      `正在上传到 ${isAliyun ? "Aliyun" : "Google"}…`
    );
    try {
      const uploaded = isAliyun
        ? await uploadToAliyun(file, model.trim())
        : await uploadToGoogle(
            file,
            mimeType.trim(),
            displayName.trim() || undefined
          );
      toast.success("上传成功", { id: toastId, description: uploaded.url });
      setResult(uploaded);
    } catch (error) {
      const message =
        error instanceof UploadClientError
          ? `${error.code}: ${error.message}`
          : error instanceof Error
            ? error.message
            : "上传失败";
      toast.error("上传失败", { id: toastId, description: message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          {isAliyun ? "阿里云 DashScope" : "Google Gemini Files API"}
        </CardTitle>
        <CardDescription>
          {isAliyun
            ? "3 步上传：getPolicy → OSS multipart → oss:// 临时 URL（48h，绑定模型）"
            : "Resumable 上传 → 标准 https:// URI（48h，支持 list/get/delete）"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isAliyun ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="aliyun-model">模型（文件绑定）</Label>
            <Input
              id="aliyun-model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="qwen-image-2.0-pro"
              disabled={loading}
            />
            <p className="text-muted-foreground text-xs">
              上传时指定的模型必须与后续调用模型的模型一致。
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="google-mime">MIME 类型</Label>
            <Input
              id="google-mime"
              value={mimeType}
              onChange={(event) => setMimeType(event.target.value)}
              placeholder="image/png"
              disabled={loading}
            />
            <Label htmlFor="google-display">显示名称（可选）</Label>
            <Input
              id="google-display"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="my-upload"
              disabled={loading}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${provider}-file-upload`}>文件</Label>
          <FilePicker
            inputId={`${provider}-file-upload`}
            file={file}
            onSelect={setFile}
            disabled={loading}
          />
        </div>

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full"
        >
          {loading ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <UploadIcon className="size-4" />
          )}
          上传
        </Button>

        {result ? <ResultDisplay result={result} provider={provider} /> : null}
      </CardContent>
    </Card>
  );
}
