## Purpose

本地媒体文件缓存：以内容哈希为身份在浏览器持久化体验者选择的文件，支持跨会话复用、去重、缩略图展示与按需读取，避免重复选择与重复传输。

## ADDED Requirements

### Requirement: Files are cached by content hash and deduplicated

系统 SHALL 以文件内容的 SHA-256 哈希作为缓存身份。相同内容的文件 SHALL 只存储一份；再次选择相同内容时 SHALL 命中缓存并复用，不产生重复存储。

#### Scenario: Re-selecting the same file hits the cache

- **WHEN** 体验者先后两次选择内容完全相同的文件
- **THEN** 第二次 SHALL 命中缓存并显示"来自缓存"标记，不重复写入存储

#### Scenario: Different content is stored separately

- **WHEN** 体验者选择两个内容不同的文件
- **THEN** 缓存 SHALL 分别保存两份记录

### Requirement: Cache persists across sessions without permission prompts

缓存 SHALL 优先使用无需用户选择目录授权的浏览器持久存储（OPFS），在内容未被浏览器回收且存储可用时，关闭并重新打开站点后仍可复用。文件字节 SHALL 存于 OPFS；IndexedDB SHALL 仅存文件名、OPFS 文件名/版本、MIME 类型、大小、缩略图与写入时间等元数据。系统 SHALL 处理 `navigator.storage.persist()` 被拒绝、配额不足或站点数据被清理的情况。

#### Scenario: Cached file survives a new session

- **WHEN** 体验者上传某文件、关闭站点、隔天重新打开并再次选择同一文件
- **THEN** 系统 SHALL 命中既有缓存条目，无需重新存储

### Requirement: Stored bytes stay raw; base64 conversion happens only at request time

缓存静态存储的 SHALL 是文件原始字节，MUST NOT 预先存储 base64 字符串。base64 编码 SHALL 仅在构造发送请求时按需执行。

#### Scenario: Storage holds raw bytes

- **WHEN** 检查缓存的静态存储内容
- **THEN** 文件 SHALL 以原始二进制形式存在，且不存在对应的 base64 持久副本

### Requirement: Gallery lists cached entries with thumbnails for reuse

系统 SHALL 提供最近缓存条目列表，展示缩略图、文件名与来源信息，支持点选复用与单条删除。列表 SHALL 按最近使用排序。

#### Scenario: Reusing an entry from the gallery

- **WHEN** 体验者在缓存列表中点选某条目
- **THEN** 对应文件 SHALL 被填充到当前图片输入并可用于提交

### Requirement: Cache enforces capacity bounds with LRU eviction

缓存 SHALL 设定容量上限（条目数量与总字节数），超限时 SHALL 按最近最少使用淘汰旧条目，且淘汰 SHALL 同时删除存储字节与元数据。

#### Scenario: Exceeding the entry cap evicts the least recently used

- **WHEN** 缓存条目数超过上限且写入新条目
- **THEN** 最久未使用的条目 SHALL 被删除，新条目写入成功

### Requirement: Cache degrades gracefully when persistent storage is unavailable

当持久存储不可用（隐私模式、浏览器不支持等）时，系统 SHALL 降级为会话内缓存并保证上传—生成流程不中断，MUST NOT 抛出未处理异常。

#### Scenario: Upload still works without persistent storage

- **WHEN** 持久存储不可用且体验者选择文件提交
- **THEN** 生成流程 SHALL 正常完成，仅缓存不跨会话保留

#### Scenario: Missing OPFS file is repaired

- **WHEN** IndexedDB 元数据存在但对应 OPFS 文件已被清理或无法读取
- **THEN** 系统 SHALL 删除或标记该坏条目，提示重新选择文件，并 SHALL NOT 发送空文件或抛出未处理异常

#### Scenario: Persistence request is denied

- **WHEN** 浏览器拒绝持久化存储请求
- **THEN** 系统 SHALL 继续使用可用的临时存储，并向体验者说明缓存可能被浏览器回收
