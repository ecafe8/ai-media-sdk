import { Badge } from "@workspace/ui/components/shadcn/badge";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { PROVIDER_LABELS } from "@/lib/key-store";
import { SITE_MODELS } from "@/lib/playground/registry";
import type { SiteModel } from "@/lib/playground/types";

const REPO_URL = "https://github.com/ecafe8/ai-media-sdk";

/**
 * Landing page: hero, feature highlights, provider/model matrix derived
 * from the SDK registries, privacy statement, and the playground entry.
 */
export function LandingPage() {
  return (
    <main className="min-h-svh bg-[#f7f8fa] text-slate-900">
      <header className="border-slate-200 border-b bg-white px-5 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <p className="font-semibold text-emerald-600 text-xs uppercase tracking-[0.24em]">
            AI Media SDK
          </p>
          <div className="flex items-center gap-3">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-slate-500 text-sm transition hover:text-slate-800"
            >
              <ExternalLink className="size-4" />
              GitHub
            </a>
            <Link
              to="/playground"
              className="rounded-lg bg-emerald-600 px-3.5 py-1.5 font-medium text-sm text-white shadow-sm transition hover:bg-emerald-700"
            >
              进入 Playground
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-16 text-center">
        <Badge variant="secondary" className="mb-4">
          纯前端体验 · 自带 Key · 无服务端中转
        </Badge>
        <h1 className="mx-auto max-w-2xl font-bold text-3xl tracking-tight sm:text-4xl">
          一个契约，驱动多家多模态生成
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-slate-500 text-sm leading-7 sm:text-base">
          AI Media SDK 统一图像与视频生成的调用契约，支持 Azure OpenAI、 Alibaba
          Bailian（DashScope）与 Volcengine Ark（Seedream）。
          在本站点填写你自己的 API Key，即可直接在浏览器体验生成与编辑。
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            to="/playground"
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-sm text-white shadow-sm transition hover:bg-emerald-700"
          >
            立即体验
            <ArrowRight className="size-4" />
          </Link>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 text-sm shadow-sm transition hover:border-emerald-300 hover:text-emerald-700"
          >
            查看文档
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-14">
        <div className="grid gap-4 sm:grid-cols-3">
          <FeatureCard
            title="图像生成与编辑"
            description="文生图、图生图统一入口；支持参考图编辑与多家模型参数。"
          />
          <FeatureCard
            title="视频生成"
            description="文生视频、首帧图生视频、参考生视频与视频编辑，浏览器内轮询异步任务。"
          />
          <FeatureCard
            title="本地优先体验"
            description="本地图片哈希缓存复用；生成结果可自动保存到你选择的目录。"
          />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-14">
        <h2 className="mb-4 font-semibold text-lg">支持的模型</h2>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <ModelMatrix />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-16">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-6 py-5">
          <h2 className="font-semibold text-slate-800">隐私与 Key 说明</h2>
          <ul className="mt-3 space-y-2 text-slate-600 text-sm leading-6">
            <li>
              · API Key 仅保存在你的浏览器 localStorage，并直接发送给对应
              Provider，不经过任何中间服务器。
            </li>
            <li>
              ·
              本地上传的图片仅缓存在你的浏览器中，按内容哈希去重，发送时才编码。
            </li>
            <li>
              · 生成结果来自 Provider 的临时
              URL，可能过期；可选择本地目录自动保存。
            </li>
            <li>
              · 自动保存目录功能基于 File System Access API，建议使用最新版
              Chrome 或 Edge。
            </li>
          </ul>
        </div>
      </section>

      <footer className="border-slate-200 border-t bg-white px-5 py-6 text-center text-slate-400 text-xs">
        AI Media SDK · 纯前端演示站点 · {new Date().getFullYear()}
      </footer>
    </main>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-slate-800">{title}</h3>
      <p className="mt-2 text-slate-500 text-sm leading-6">{description}</p>
    </div>
  );
}

function capabilityBadges(model: SiteModel): readonly string[] {
  const badges: string[] = [];
  if (model.supportsGenerate) badges.push("生成");
  if (model.supportsEdit) badges.push("编辑");
  if (model.supportsVideo) badges.push("视频");
  if (model.supportsAsync) badges.push("异步");
  return badges;
}

function ModelMatrix() {
  const providers = [...new Set(SITE_MODELS.map((m) => m.provider))];
  return (
    <div className="divide-y divide-slate-100">
      {providers.map((provider) => {
        const models = SITE_MODELS.filter((m) => m.provider === provider);
        return (
          <div key={provider} className="px-5 py-4">
            <h3 className="mb-2.5 font-medium text-slate-800 text-sm">
              {PROVIDER_LABELS[provider]}
              <span className="ml-2 text-slate-400 text-xs">
                {models.length} 个模型
              </span>
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {models.map((model) => (
                <div
                  key={model.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-slate-700 text-sm">
                      {model.label}
                    </p>
                    <p className="truncate font-mono text-slate-400 text-xs">
                      {model.id}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {capabilityBadges(model).map((badge) => (
                      <Badge key={badge} variant="outline" className="text-xs">
                        {badge}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
