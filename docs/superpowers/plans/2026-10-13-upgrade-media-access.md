# T02/T03前置批：媒体定位与服务端访问边界

日期：2026-10-13。依据[主计划](../../2026-10-10-integrated-upgrade-plan.md)的访问/保存契约、T02/T03，以及用户继续执行升级的授权。该批先修复现有管理员入口；不是宣布P0/G0完成，也不是全量资产迁移。

## Global Constraints

- D01–D16全部A继续有效；复用现有Next.js/Supabase，正式路径不得产生模拟档案。
- 已有T00变更保留；不得回退其真实失败/置信度/录音隔离行为。
- 仅本地代码、测试、契约；不操作远端数据库、真实家庭资料或付费供应商，不部署、不推送。
- 保留现有工作树与所有旧文档；本批不自动提交，避免将既有未提交内容混入独立提交。用文件快照diff与SHA256绑定审阅/测试。
- 原始bucket/key必须原样传递；不按basename推测，不跨bucket重试；未知/歧义地址失败关闭。
- 鉴权先于管理员存储读取/签名/写入。项目内对象的上传者前缀不能绕过已失效的项目权限。
- 无法用本地修复证明直接Storage RLS、已签发链接即时撤销、供应商用途同意、物理删除或G1验收。

## Task 1: 统一现有媒体请求的定位与授权

**Files:** 新增`packages/web/src/lib/media-reference.ts`与`lib/server/media-access.ts`；修改`app/api/media/signed-url/route.ts`、`app/api/media/upload-image/route.ts`、`app/api/ai/transcribe/route.ts`、`lib/ai-service.ts`；新增/扩展上述模块邻近测试。相对路径均以`packages/web/src/`为根。不得修改删除、导出、Recorder或数据库schema；它们在后续资产/任务批完成。

### 1. 纯媒体地址契约

- `{ bucket, path }`：只接受`audio-recordings`或`saga`，path为非空原始对象key。只接受字符串，拒绝URL、绝对路径、反斜杠、控制符、`?`、`#`、`%`（含多次编码）、空目录、`.`/`..`目录、首尾空白。验证后不解码、不折叠、不改写合法key；支持普通Unicode/空格文件名。
- 已存在的结构：`owner/projects/projectId/.../file`；`owner/images/stories/storyId/file`和`owner/images/interactions/storyId/file`；其他私人路径（包括`owner/temp/session/chunk`、`owner/images/file`、`owner/uploads/file`）只能由owner读取。项目或故事标记格式残缺不得回退到私人路径；嵌套伪造`projects`目录拒绝。
- 不把路径验证称为MediaAsset身份表。旧完整URL/含编码key需要显式历史映射后才能使用，不猜测回源。

### 2. 共用服务端授权

- 项目路径从确定位置取projectId，经现有`requireProjectAccess`检查实际项目facilitator或active project_roles；即使owner等于当前用户也先检查项目权限。
- 故事图片路径先按storyId读取实际`stories.project_id`，再检查项目访问；非项目私人路径严格比较owner与当前用户。
- 项目/故事不存在、成员移除/待接受、数据库错误、缺服务配置均失败关闭；不得调用存储签名/下载/上传或ASR供应商。复用现有503/500/404/403语义，非法输入400。
- 每个已认证响应保留auth/rate-limit headers；签名响应`Cache-Control: no-store`。不向日志输出签名URL、密钥或家庭正文。

### 3. 签名URL路由

- JSON解析/对象结构校验；调用共享定位和授权后才createSignedUrl。请求中的bucket/path不强制字符串化。
- expiresIn缺省3600，仅接受有限正数，维持60–3600秒范围（取整数）；NaN/Infinity/字符串/非正数400。维持现有返回`{signedUrl}`。
- 测试合法项目成员可读、跨家庭拒绝、已移除上传者不能凭前缀绕过、私人文件本人可读/他人不可读、路径编码/穿越/URL/伪项目目录拒绝、配置失败关闭及响应header保留。

### 4. ASR使用同一定位

- 保留直接File上传；storagePath请求新增可选`storageBucket`。缺省`audio-recordings`与`uploadStoryAudio`一致；确知旧对象在`saga`时须显式传`saga`，缺件不探测另一桶。
- `AIService.transcribeAudio`选项增加同名bucket字段并随storagePath发送；无storagePath时不发送。保留T00验证与失败行为。
- 同时提交audio和storagePath、非File的audio、非string的storage字段、空路径/非法bucket均400；认证仍在解析前。
- 共享授权必须在admin下载及供应商调用之前完成。权限失败保留原状态码和rate-limit headers。
- 向供应商传真实文件名/对象basename和已有MIME；不得将所有原件冒称`audio.webm`。无MIME时可按有限音频扩展映射；未知时保留octet-stream，不编造媒体类型。
- 直接上传上限仍为4MiB，修正现有25MB错误提示；存储下载上限采用现有录音上传100MiB边界：授权后先读取元数据，超限直接413；使用SDK流式下载按实际字节累加，未知或低报size也不能绕过，越限取消读取且不提交供应商。转写质量和供应商实际格式支持仍待资格/实测，不改变供应商。
- 回归验证默认/显式bucket、不同目录同名文件原样定位、缺件不跨桶、跨家庭/移除用户无下载和付费请求、MIME/文件名保留、直接File路径可用、非法载荷/大小拒绝。

### 5. 图片上传认证与原件

- `getAuthenticatedUser(request)`先于formData/sharp/admin；移除admin.auth.getUser与anonymous回退。
- 支持当前调用的默认`images`、`images/stories/{storyId}`、`images/interactions/{storyId}`，以及明确的`projects/{projectId}/...`文件夹；文件夹用相同严格目录规则校验。不接受任意模糊目标。
- 图片故事/项目目标经共享授权再调用sharp、upload、createSignedUrl；响应含auth headers，私密响应no-store。原件与缩略图都位于当前认证用户的确切目录下。
- 原件保留原始字节，只有缩略图经过sharp；MIME决定扩展名，既有5MiB与JPEG/PNG/GIF限制保留。两次upload或签名失败不能返回success，保留现有返回字段供当前调用方使用。
- 不在本批声称实现上传事务/孤儿清理；中途失败的清理由后续资产会话/任务提供。
- 测试未认证不解析/处理/写入、非法/越权folder不写入、合法本人/项目/故事路径正确、无anonymous写入、原件字节不重编码、失败不返回成功。

### 6. 测试与交付

- TDD：先添加针对上述实际失败的回归，运行并保存红测，再实施。测试保留真实解析/授权逻辑，外部Supabase/供应商/sharp作为边界替身；必须断言确切bucket/key与没有未经授权的I/O。
- 日志保存`docs/research/evidence/2026-10-13-media-access/`；记录实际失败和数量，禁止把环境错误当成功红测。
- 先定向Jest与类型检查，再自审。控制者最后跑`npm run verify`，按受影响范围复用或补shared/infra，独立复审后回写主计划/决策/审计与本计划状态。
- 本批验收=应用入口回归、完整verify、独立复审通过；存储RLS、历史对象映射、删除、真机和线上验证仍有单独待办。

## 当前进度

- [x] Task 1实现及定向回归：3套/75项通过；复审提出的流式上限、MIME原型键和C1控制符均已修复。
- [x] 独立复审与最终verify：原3项发现全部关闭；verify退出0，58套/488项，类型/lint/build通过。
- [x] P0质量门/P1契约、文档状态与证据更新：[实施记录](../../research/2026-10-13-media-access-implementation.md)与[验证证据](../../research/evidence/2026-10-13-media-access/README.md)。本批已完成，G0及T02/T03整体仍未完成。
