# npm 发布流程

本文档说明 AI Media SDK monorepo 的 npm 发布流程。

## 发布包

当前发布以下 5 个公开包：

1. `@ai-media/sdk`
2. `@ai-media/uploader`
3. `@ai-media/provider-azure-openai`
4. `@ai-media/provider-aliyun-bailian`
5. `@ai-media/provider-seedream`

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

发布前修改 5 个包的 `version`。npm 不允许重复发布同一个包的同一个版本。

例如将版本从 `0.1.0` 升级到 `0.1.1`：

```bash
npm version 0.1.1 --workspace=@ai-media/sdk --no-git-tag-version
npm version 0.1.1 --workspace=@ai-media/uploader --no-git-tag-version
npm version 0.1.1 --workspace=@ai-media/provider-azure-openai --no-git-tag-version
npm version 0.1.1 --workspace=@ai-media/provider-aliyun-bailian --no-git-tag-version
npm version 0.1.1 --workspace=@ai-media/provider-seedream --no-git-tag-version
```

也可以直接手动修改各包的 `package.json`，然后用 `git diff` 检查版本变更。

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
- `npm pack --dry-run --json`
- tarball 文件清单检查
- `dist/*.js` 和 `dist/*.d.ts` 检查
- README、LICENSE 检查
- `.env`、`src`、测试文件和 `node_modules` 排除检查

检查失败时不要继续发布。先修复问题，再重新执行该命令。

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
npm pack --dry-run --json --workspace=@ai-media/provider-seedream
```

## 正式发布

必须按照依赖顺序发布。先发布 SDK 和 uploader，再发布 provider：

```bash
npm publish --workspace=@ai-media/sdk --access public
npm publish --workspace=@ai-media/uploader --access public
npm publish --workspace=@ai-media/provider-azure-openai --access public
npm publish --workspace=@ai-media/provider-aliyun-bailian --access public
npm publish --workspace=@ai-media/provider-seedream --access public
```

每次发布后确认 npm registry 中的版本已经可见：

```bash
npm view @ai-media/sdk version
npm view @ai-media/uploader version
npm view @ai-media/provider-azure-openai version
npm view @ai-media/provider-aliyun-bailian version
npm view @ai-media/provider-seedream version
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
npm view @ai-media/provider-seedream dependencies
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
npm access ls-packages
```

### provider 找不到 SDK

确认 SDK 已先发布，并且 provider 的 `dependencies` 使用实际 npm 版本，而不是 `workspace:*`。

### tarball 缺少 dist 文件

先重新构建并检查：

```bash
bun run build
bun run release:pack
```

### 测试或类型检查失败

不要跳过 `release:check`。发布包必须先通过检查；如果是与本次发布无关的既有失败，应单独修复或明确记录后再发布。
