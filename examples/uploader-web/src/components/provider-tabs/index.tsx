import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/shadcn/tabs";
import { UploadCard } from "@/components/upload-card";

export function ProviderTabs() {
  return (
    <Tabs defaultValue="aliyun" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="aliyun" className="flex-1">
          Aliyun DashScope
        </TabsTrigger>
        <TabsTrigger value="google" className="flex-1">
          Google Gemini
        </TabsTrigger>
      </TabsList>
      <TabsContent value="aliyun">
        <UploadCard provider="aliyun" />
      </TabsContent>
      <TabsContent value="google">
        <UploadCard provider="google" />
      </TabsContent>
    </Tabs>
  );
}
