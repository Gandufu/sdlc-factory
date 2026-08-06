# Factory Console 0.1.0

## 已交付

- Electron Renderer 已迁移到 Tailwind CSS v4 与 shadcn/ui `new-york` 设计系统。
- 项目目录、三步创建、初始化证据与人工审核均读取 Spring Boot 权威状态。
- 运行中心提供 Run 五列、容量抽屉、SSE 观测状态与非实时投影提示。
- 待处理中心不再使用 fixture，集中展示等待裁决、阻塞和人工介入事项。
- 项目工作区支持跨多个不可变 Run 的 Factory Session、Child Session、结构化 Handoff、Evidence、人工 Gate 与 Baseline。
- OpenCode SDK 固定通过 Node/TypeScript Bridge 调用 `openai/gpt-5.6-luna#max`，Renderer 不接触 SDK。

## 已知限制

- 项目级 Agents、Skills、MCP 与 Plugins 尚无可写绑定合同，因此配置页只展示后端已支持的只读运行时摘要。
- OpenCode Bridge 当前固定禁止工具调用；会话纵切用于合同、Handoff 和 Gate 验收，不执行文件编辑。
- 容量调度器的活动权与等待队列仍在进程内维护；Run、Session、Gate、Evidence 与 Baseline 已持久化到 PostgreSQL。
- 当前只生成 Windows x64 Squirrel 安装包，尚未进行数字签名。

## 发布验证

发布前必须通过 Renderer lint、typecheck、单元/组件测试、真实 Electron E2E、Electron package、Windows maker、完整 Maven Reactor、OpenCode Luna max 纵切与 PostgreSQL 重启持久化验证。
