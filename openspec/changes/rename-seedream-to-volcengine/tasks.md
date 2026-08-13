## 1. Provider 包改名

- [ ] 1.1 `git mv packages/provider-seedream packages/provider-volcengine`,更新 `package.json` 的 `name`(`@ai-media/provider-volcengine`)与 `description`
- [ ] 1.2 更新包内源码:`providerId` `doubao-seedream` → `volcengine`(provider/index.ts、provider/registry.ts),`providerOptions` 命名空间 `seedream` → `volcengine`
- [ ] 1.3 改名导出符号:`createVolcengineProvider`、`VolcengineProvider`、`VolcengineProviderOptions`、`VolcengineConfig`、`VOLCENGINE_MODEL_REGISTRY`、`volcengineModelRegistry`、`VolcengineModelEntry`、`VolcengineParamSupport`、`VolcengineOutputFormat`、`VolcengineImageProviderOptions`、`VolcengineOptimizePromptOptions`
- [ ] 1.4 改名家族参数类型(厂商前缀 + 家族):`VolcengineSeedream5ProParams`、`VolcengineSeedream5LiteParams`、`VolcengineSeedream45Params`、`VolcengineSeedream40Params`、`VolcengineSeedreamFamilyOptions`
- [ ] 1.5 更新包内测试(`tests/`)与 `README.md` 的标识符与符号引用;模型 ID 与家族 slug 保持不变

## 2. 示例改名

- [ ] 2.1 `git mv examples/seedream-image examples/volcengine-image`,更新 `package.json` 的 `name`(`@ai-media/example-volcengine-image`)与对 `@ai-media/provider-volcengine` 的依赖
- [ ] 2.2 更新 `src/` 的导入与符号:`createVolcengineProvider`、`VolcengineConfig`;模型选择环境变量 `SEEDREAM_MODEL` → `VOLCENGINE_IMAGE_MODEL`(保留 `ARK_API_KEY`/`ARK_BASE_URL`),同步 `.env.example` 与测试

## 3. apps/web 引用更新

- [ ] 3.1 更新 `package.json` 依赖与 `next.config.ts` 的包名引用
- [ ] 3.2 更新 `lib/playground/`:`server.ts`、`registry.ts`、`types.ts`、`provider-credentials.ts` 的 provider id(`doubao-seedream` → `volcengine`)、`resolveVolcengineCredentials`、`VOLCENGINE_MODEL_REGISTRY` 导入与全部相关测试
- [ ] 3.3 更新 `components/playground/lib/`(`credentials.ts`、`image-form-schema.ts` 中 `seedream.*` → `volcengine.*`)与 `app/api/playground/generate/route.ts` 及测试

## 4. apps/site 引用更新

- [ ] 4.1 更新 `package.json` 依赖、`tsconfig.json` paths、`vite.config.ts` alias 的包名
- [ ] 4.2 更新 `src/lib/`:`key-store.ts`(provider id、label、凭证解析)、`provider-client.ts`、`executor.ts`、`playground/registry.ts`、`playground/types.ts` 的导入与 provider id
- [ ] 4.3 更新 `src/components/settings-dialog/` 的 provider id 引用;更新 `src/locales/en.json`、`zh.json` 中模型标签键前缀 `doubao-seedream:` → `volcengine:` 及相关文案

## 5. 文档与 OpenSpec 同步

- [ ] 5.1 更新根 `README.md` 的包表、示例目录与运行命令引用
- [ ] 5.2 将进行中的 `openspec/changes/add-site-docs/` 工件中 `providers/seedream.mdx` 引用改为 `providers/volcengine.mdx`

## 6. 验证

- [ ] 6.1 `bun run lint` 与 `bun run format` 检查通过
- [ ] 6.2 `bun run typecheck` 全部 workspace 通过
- [ ] 6.3 `bun run build` 与 `bun run test` 全部通过
- [ ] 6.4 残留校验:`grep -ri seedream` 仅命中模型 ID `doubao-seedream-*`、家族 slug、`VolcengineSeedream*` 类型名、历史文档(docs/prd、openspec archive)与示例模型家族文案
