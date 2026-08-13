## Context

`packages/provider-seedream` 以图像模型家族命名,无法容纳字节视频家族 Seedance;仓库其余 Provider 包(`azure-openai`、`aliyun-bailian`、`minimax`)均为厂商/平台命名,且其 `providerId` 与 `providerOptions.<namespace>` 也遵循厂商短名(`azure-openai`/`azure`、`aliyun-bailian`/`aliyun`、`minimax`/`minimax`)。Seedream 与 Seedance 均由火山方舟(Ark)提供,凭证环境变量已是 `ARK_*`,端点为 `*.volces.com`。约束:模型 ID(`doubao-seedream-*`)是 Ark API 事实不可改;包处于 0.x 阶段,允许破坏式改名;`@ai-media/provider-seedream@0.1.0` 已发布到 npm。

## Goals / Non-Goals

**Goals:**
- 包、`providerId`、`providerOptions` 命名空间、导出符号全部收拢为厂商级 `volcengine`,与 aliyun/azure/minimax 的命名规律一致。
- 为 Seedance 视频与未来 Ark 模型预留同一包边界(后续在包内新增 video 家族,不改包名)。
- 模型 ID 与家族 slug 保持 API 事实不变。

**Non-Goals:**
- 不改 `ARK_*` 环境变量前缀(保留,避免破坏既有 `.env`;密钥来源平台即 Ark)。
- 不提供旧包名/旧符号的兼容别名层(0.x 阶段直接破坏式迁移)。
- 不接入 Seedance 视频能力(本次仅改名,视频是后续切片)。
- 不改写 `docs/prd/` 与已归档 OpenSpec 变更等历史记录。

## Decisions

**包名取 `provider-volcengine`,而非 `provider-bytedance`/`provider-seed`/`provider-volcengine-ark`。** 实际 API 面是火山方舟(`ARK_*` 凭证、`*.volces.com` 端点),厂商级命名对齐 `aliyun` 先例;`bytedance` 是公司品牌而非 API 面,`seed` 是模型家族前缀、装不下非 Seed 系模型;`volcengine-ark` 虽完全镜像 `aliyun-bailian` 的"厂商+平台",但选择更短的厂商级名称,平台信息留在文档与默认 base URL 中。

**`providerId` 改为 `volcengine`,命名空间改为 `providerOptions.volcengine`。** 与其他 Provider 的厂商级标识符一致;`doubao-seedream` 作为 providerId 会让后续 Seedance 视频模型挂在语义错误的 id 下。影响:站点 localStorage 中以 `${provider}:${model}` 为键的凭证/草稿在改名后失效并回到未配置状态(0.x 可接受,不做迁移脚本)。

**符号命名按 aliyun 先例:厂商前缀 + 家族名。** 工厂与 Provider 级符号:`createVolcengineProvider`、`VolcengineProvider`、`VolcengineProviderOptions`、`VolcengineConfig`、`VOLCENGINE_MODEL_REGISTRY`、`volcengineModelRegistry`、`VolcengineModelEntry`、`VolcengineParamSupport`、`VolcengineOutputFormat`、`VolcengineImageProviderOptions`、`VolcengineOptimizePromptOptions`。家族参数类型保留家族名并加厂商前缀:`VolcengineSeedream5ProParams`、`VolcengineSeedream5LiteParams`、`VolcengineSeedream45Params`、`VolcengineSeedream40Params`、`VolcengineSeedreamFamilyOptions`(对应 `AliyunWan27ImageParams` 等先例);后续 Seedance 家族即 `VolcengineSeedance*Params`。

**模型 ID、家族 slug、模型显示名不变。** `doubao-seedream-*` 是 Ark 模型 ID;Playground 家族 slug(`doubao-seedream-5-pro` 等)与 "Doubao Seedream 5.0 Pro" 等显示名描述模型而非 Provider,保留。locales 中模型标签键前缀由 `doubao-seedream:` 变为 `volcengine:`(键含 providerId)。

**示例目录改为 `examples/volcengine-image`,模型选择变量改为 `VOLCENGINE_IMAGE_MODEL`。** 对齐 `aliyun-bailian-image`/`ALIYUN_BAILIAN_IMAGE_MODEL` 先例;`ARK_API_KEY`/`ARK_BASE_URL` 保留。

**OpenSpec 处理:能力更名。** `doubao-seedream-image-generation` 以 REMOVED delta 移除,新建 `volcengine-image-generation`(ADDED delta 携带 Purpose 与更新后的全部需求);其余受影响能力用 MODIFIED delta 更新引用。进行中的 `add-site-docs` 变更工件中 `providers/seedream.mdx` 引用同步改为 `providers/volcengine.mdx`。

## Risks / Trade-offs

- [已发布的 `@ai-media/provider-seedream@0.1.0` 仍指向旧名] → 合并后发布 `@ai-media/provider-volcengine` 并对旧包执行 `npm deprecate` 指向新包。
- [站点用户 localStorage 凭证键失效] → 0.x 阶段接受;设置面板重新填写即可,无数据损失风险(Key 本就只存本地)。
- [大量文件改名易遗漏引用] → 以 `grep -ri seedream` 收敛校验:允许残留仅限模型 ID `doubao-seedream-*`、家族 slug、`VolcengineSeedream*` 类型名、历史文档(docs/prd、openspec archive)与示例文案中的模型家族描述。
- [apps/web 与 apps/site 各自维护 registry/credentials,改名不同步会导致运行时分支漏匹配] → 两应用的 provider id 字符串、switch 分支、测试一并更新,并以各应用测试覆盖。

## Migration Plan

1. `git mv` 包与示例目录,全仓替换符号与标识符,更新 apps 与文档。
2. 验证:`bun run lint && bun run typecheck && bun run build && bun run test`,残留 grep 校验。
3. 合并后:发布 `@ai-media/provider-volcengine`,`npm deprecate @ai-media/provider-seedream`。
4. 回滚:还原本变更分支的合并即可;npm 旧包仍在,deprecate 可撤销。
