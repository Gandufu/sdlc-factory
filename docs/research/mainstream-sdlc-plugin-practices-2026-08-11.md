# 主流项目对生命周期插件重构的参考结论

状态：本次实现依据
更新日期：2026-08-11

## 1. 调研目的

本次调研只回答一个问题：如何让 OpenCode 项目插件从原始描述或需求资料出发，引导完成需求、设计、编码、模块测试、系统测试和验收，同时避免巨型上下文、隐藏状态和重复模型调用。

调研结论用于约束当前插件实现，不覆盖仓库中的正式需求与设计。发生冲突时，以 `docs/design/01` 至 `03` 的正式方案为准。

## 2. OpenCode 原生边界

OpenCode 官方资料确认：

- 项目可以在 `.opencode/plugins/` 提供插件，在 `.opencode/commands/` 提供命令，在 `.opencode/skills/` 提供按需加载的 Skills；
- 自定义工具可以取得会话编号、项目目录和工作区信息，适合承载路径、版本、审核和证据等确定性校验；
- 插件事件包含命令、工具、文件、会话和待办更新，可用于观察 `todowrite` 是否实际执行；
- 模型和推理档位可以由命令行明确覆盖，因此本次验证固定使用 `openai/gpt-5.6-luna --variant max`；
- `opencode run` 是阻塞式命令入口，测试应等待进程和结构化输出结束，不应依赖固定 sleep 轮询会话状态。

依据：[自定义工具](https://opencode.ai/docs/custom-tools/)、[命令](https://opencode.ai/docs/commands/)、[插件](https://opencode.ai/docs/plugins/)、[模型](https://opencode.ai/docs/models/)、[插件加载源码](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/plugin/index.ts)。

## 3. 主流项目中采用的做法

### 3.1 GitHub Spec Kit

Spec Kit 使用逐步产物把需求、方案、任务和实现分开，并提供跨产物分析和人工门槛。当前插件采用其中三点：

1. 需求、设计、测试说明和实现分别形成可检查产物；
2. 在进入下一阶段前执行结构、引用和一致性检查；
3. 候选形成后停下，由用户显式审核。

没有采用其独立任务文件作为项目事实。当前方案已经明确：项目进度必须从生命周期事实实时推导，OpenCode 待办只服务一次编码会话。

依据：[Spec Kit 总览](https://github.github.com/spec-kit/)、[工作流说明](https://github.com/github/spec-kit/blob/main/docs/reference/workflows.md)、[快速开始](https://github.com/github/spec-kit/blob/main/docs/quickstart.md)。

### 3.2 OpenSpec

OpenSpec 把当前正式内容与待审变更分开，待审内容经过应用和归档后才进入当前事实。当前插件采用这一边界：

- 工作区正文可以反复修改；
- 候选固定文件字节、哈希、父版本和输入版本；
- 人工通过后才形成不可变已批准版本；
- 历史修订保留，不用“最新”覆盖过去。

没有采用其任务清单作为生命周期权威。

依据：[OpenSpec 仓库](https://github.com/Fission-AI/OpenSpec)、[OpenSpec 总览](https://github.com/Fission-AI/OpenSpec/blob/main/docs/overview.md)。

### 3.3 BMAD Method

BMAD Method 的阶段化资料和下一步引导说明，证明“先恢复当前事实，再只装配当前阶段需要的上下文”适合长生命周期会话。当前插件采用：

- 每条命令先查询状态；
- 每次只装配目标业务模块及必要接口、质量要求和直接依赖；
- 每轮只给一条完整建议命令，且不自动执行。

没有采用大量角色和代理层级。当前最小闭环更需要稳定事实和低上下文成本。

依据：[BMAD 工作流图](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/docs/reference/workflow-map.md)。

## 4. 落地取舍

| 问题 | 本次选择 | 原因 |
| --- | --- | --- |
| 项目计划 | 不建立独立计划 | 会与生命周期事实和状态投影形成双重权威 |
| 工作单位 | 需求阶段确定的业务模块 | 同一稳定编号贯穿需求、设计、编码和测试 |
| 编码待办 | 使用 OpenCode 原生 `todowrite` | 只反映当前编码会话，能被实际更新和观察 |
| 正式版本 | 候选经直接用户审核后生成 | AI 不能自行产生审核和通过事实 |
| 项目进度 | 每次查询时推导 | 删除投影后仍可由版本、审核、运行和测试记录重建 |
| 测试执行 | 受控工具直接等待进程结束 | 不需要模型参与测试过程，也不需要固定 sleep |
| 系统测试 | 复用有效模块证据，Playwright 只跑跨模块流程 | 避免现场重新生成测试和重复消耗令牌 |
| 上下文 | 按模块和版本装配，单文件及总量设上限 | 防止把完整需求、设计、日志和历史会话一次性送入模型 |

## 5. 对当前实现的硬要求

1. 不保留能力单元、独立执行计划或旧字段兼容别名；
2. 需求地图必须校验稳定编号、功能组、依赖、接口和非功能需求作用范围；
3. 候选必须保存实际文件快照，审核时同时复核工作区和不可变快照；
4. 代码候选必须绑定成功运行、真实 Git 基点、精确输入版本和批准路径边界；
5. 编码运行在任何修改和命令前必须实际建立 OpenCode 待办；
6. 测试退出码、耗时、输出哈希和证据由受控执行器生成，AI 不能填写通过结果；
7. 报告只能由测试记录生成，失败、跳过和阻塞不能改写为通过；
8. 项目进度不持久化、不拥有版本号，只展示最新推导状态。
