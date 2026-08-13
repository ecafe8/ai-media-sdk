# npm 发布流程

本文档说明 AI Media SDK monorepo 的 npm 发布流程。

## 日常发布主流程

日常发布只需要执行以下步骤：

1. 确认已登录 npm，并确认工作区没有无关修改：

   ```bash
   npm whoami
   git status --short
   ```

2. 自动递增 5 个包的 patch 版本：

   ```bash
   bun run release:version
   ```

3. 先执行 dry-run，确认检查和发布内容没有问题：

   ```bash
   bun run release -- --dry-run
   ```

4. 正式发布。脚本会 执行 release:check 并 发布 npm 包、创建 release commit 和 Git tag，默认不 push：

   ```bash
   bun run release
   ```

5. 确认本地 commit 和 tag 后推送：

   ```bash
   git push origin main v0.1.1
   ```

也可以让脚本在发布成功后自动推送：

```bash
bun run release -- --push
```

其中 `v0.1.1` 替换为本次实际发布版本。版本升级、检查项、beta 发布和故障处理见后续章节。

## 发布包

当前发布以下 6 个公开包：

1. `@ai-media/sdk`
2. `@ai-media/uploader`
3. `@ai-media/provider-azure-openai`
4. `@ai-media/provider-aliyun-bailian`
5. `@ai-media/provider-volcengine`
6. `@ai-media/provider-minimax`

不要发布以下 workspace 包：

- `@workspace/ui`
- `@workspace/typescript-config`
- `@workspace/eslint-config`
- `apps/*`
- `examples/*`

## 发布前准备

确保使用仓库要求的运行环境：

```bash
bun --version
node --version
```

应使用 Bun `1.3.14`，Node.js `>=20`。

确认工作区干净，或确认工作区中的其他修改不属于本次发布：

```bash
git status --short
```

确认 npm 账号已经登录，并且拥有 `@ai-media` scope 的发布权限：

```bash
npm login
npm whoami
npm access list packages
```

如果 npm 账号启用了双因素认证，发布时按提示输入 OTP。

## 修改版本

发布前使用版本脚本修改 5 个包的 `version`。npm 不允许重复发布同一个包的同一个版本。

默认不传参数时，脚本读取 `@ai-media/sdk` 当前版本并自动递增 patch 版本。例如当前版本为 `0.1.0`：

```bash
bun run release:version
# 5 个包都会更新为 0.1.1
```

也可以指定升级类型或明确版本号：

```bash
bun run release:version -- patch  # 0.1.0 -> 0.1.1
bun run release:version -- minor  # 0.1.0 -> 0.2.0
bun run release:version -- major  # 0.1.0 -> 1.0.0
bun run release:version -- 0.2.0
```

脚本会同时更新 provider 对 `@ai-media/sdk` 的依赖，例如更新为 `^0.1.1`。脚本不会自动提交或创建 Git tag。执行后检查修改：

```bash
git diff -- packages/*/package.json
```

provider 包依赖 `@ai-media/sdk`。发布新版本时，provider 的依赖版本必须指向已经发布到 npm 的 SDK 版本，例如：

```json
{
  "dependencies": {
    "@ai-media/sdk": "^0.1.1"
  }
}
```

不要在可发布包的 `dependencies` 中保留 `workspace:*`。

## 自动检查

先执行完整发布检查：

```bash
bun install
bun run release:check
```

`release:check` 会执行：

- workspace lint
- 5 个发布包的生产类型检查
- workspace build
- workspace test
- 包元数据检查
- 查询 npm registry 最新版本，检查本地版本是否冲突
- `npm pack --dry-run --json`
- tarball 文件清单检查
- `dist/*.js` 和 `dist/*.d.ts` 检查
- README、LICENSE 检查
- `.env`、`src`、测试文件和 `node_modules` 排除检查

检查失败时不要继续发布。先修复问题，再重新执行该命令。

如果本地版本小于或等于 npm registry 的最新版本，检查会失败并提示执行：

```bash
bun run release:version
```

尚未发布到 npm 的包会标记为首次发布。registry 查询失败时检查也会失败，避免网络或权限问题被误判为首次发布。

## 查看发布内容

执行以下命令生成并检查 5 个包的 tarball：

```bash
bun run release:pack
```

该命令会先执行全部发布检查，然后为每个包运行 `npm pack`。确认生成的 `.tgz` 文件内容只包含发布所需文件后再继续。

检查单个包的内容也可以使用：

```bash
npm pack --dry-run --json --workspace=@ai-media/sdk
npm pack --dry-run --json --workspace=@ai-media/uploader
npm pack --dry-run --json --workspace=@ai-media/provider-azure-openai
npm pack --dry-run --json --workspace=@ai-media/provider-aliyun-bailian
npm pack --dry-run --json --workspace=@ai-media/provider-volcengine
npm pack --dry-run --json --workspace=@ai-media/provider-minimax
```

## 正式发布

推荐使用自动化发布脚本：

```bash
bun run release
```

该命令要求 5 个包已经使用同一个版本号，并按以下顺序执行：

1. 检查工作区是否存在未预期的修改
2. 执行 `release:check`
3. 按依赖顺序发布 5 个包到 npm `latest` tag
4. 轮询 npm registry（每 5 秒一次，最长 2 分钟）验证每个包的版本可以获取；超时仍未可见时给出警告并继续
5. 创建发布 commit：`chore: release v<version>`；如果版本号已经在提交历史中，则跳过该步骤，避免空提交
6. 创建 Git tag：`v<version>`

脚本默认不 push。确认本地 commit 和 tag 无误后执行：

```bash
git push origin main v0.1.1
```

也可以让脚本自动 push：

```bash
bun run release -- --push
```

正式发布前可使用 dry-run。它会执行检查和 `npm publish --dry-run`，不会发布 npm 包，也不会创建 commit、tag 或 push：

```bash
bun run release -- --dry-run
```

发布 beta 或其他 npm dist-tag：

```bash
bun run release -- --tag beta
```

用户可以通过以下方式安装 beta 版本：

```bash
npm install @ai-media/sdk@beta
```

版本号不会由 `release` 自动修改。先运行 `release:version`，检查版本变更后，再运行 `release`：

```bash
bun run release:version
git diff -- packages/*/package.json
bun run release
```

必须按照依赖顺序发布。先发布 SDK 和 uploader，再发布 provider：

```bash
npm publish --workspace=@ai-media/sdk --access public
npm publish --workspace=@ai-media/uploader --access public
npm publish --workspace=@ai-media/provider-azure-openai --access public
npm publish --workspace=@ai-media/provider-aliyun-bailian --access public
npm publish --workspace=@ai-media/provider-volcengine --access public
npm publish --workspace=@ai-media/provider-minimax --access public
```

每次发布后确认 npm registry 中的版本已经可见：

```bash
npm view @ai-media/sdk version
npm view @ai-media/uploader version
npm view @ai-media/provider-azure-openai version
npm view @ai-media/provider-aliyun-bailian version
npm view @ai-media/provider-volcengine version
npm view @ai-media/provider-minimax version
```

provider 发布前，确认它依赖的 `@ai-media/sdk` 版本已经可以被 npm registry 安装。

## 发布后验证

在临时目录验证公开包可以安装和导入：

```bash
mkdir -p /tmp/ai-media-release-smoke
bun add --cwd /tmp/ai-media-release-smoke @ai-media/sdk @ai-media/uploader
```

检查 provider 包的 npm 元数据和依赖：

```bash
npm view @ai-media/provider-azure-openai dependencies
npm view @ai-media/provider-aliyun-bailian dependencies
npm view @ai-media/provider-volcengine dependencies
npm view @ai-media/provider-minimax dependencies
```

如果需要撤回版本，只能在 npm 允许的撤回窗口内执行；优先发布修复版本，不要依赖删除已发布版本作为常规回滚方案。

## CI 发布建议

正式 CI 发布至少应执行：

```bash
bun install --frozen-lockfile
bun run release:check
```

CI 使用 npm token 登录，不要把 token 写入仓库或命令行日志。推荐使用 npm 的受限 automation token，并将其配置为 CI secret。

如果在 GitHub Actions 中启用 provenance，需要配置 npm trusted publishing 或 OIDC 权限；本地开发机不要使用 `--provenance`。

## 常用故障处理

### 版本已存在

错误通常表示 npm 上已经存在该版本。升级所有相关包的版本后重新检查：

```bash
bun run release:check
```

### scope 权限不足

确认登录账号和 scope 权限：

```bash
npm whoami
npm access list packages
```

### provider 找不到 SDK

确认 SDK 已先发布，并且 provider 的 `dependencies` 使用实际 npm 版本，而不是 `workspace:*`。

### tarball 缺少 dist 文件

先重新构建并检查：

```bash
bun run build
bun run release:pack
```

### 发布成功但验证 404

新包发布后，npm registry 存在短暂的传播延迟，`npm view` 可能立即返回 404。`release` 脚本会轮询等待最长 2 分钟；如果超时仍未可见，脚本会警告并继续创建 commit 和 tag，之后手动确认：

```bash
npm view @ai-media/sdk version
```

如果旧版脚本在验证失败后中断，导致包已发布但没有 Git tag，可以手动补齐：

```bash
git tag -a v<version> -m "Release v<version>"
git push origin v<version>
```

### 测试或类型检查失败

不要跳过 `release:check`。发布包必须先通过检查；如果是与本次发布无关的既有失败，应单独修复或明确记录后再发布。
