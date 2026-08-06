import { TriangleAlertIcon } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/shadcn/alert";

export function Warnings() {
  return (
    <Alert variant="default">
      <TriangleAlertIcon />
      <AlertTitle>仅用于开发与测试</AlertTitle>
      <AlertDescription>
        临时 URL 有效期 48 小时；阿里云上传凭证接口限流 100 QPS（账号+模型维度，
        不可扩容）。请勿用于生产、高并发或压测场景，生产环境请使用阿里云 OSS
        等稳定存储。
      </AlertDescription>
    </Alert>
  );
}
