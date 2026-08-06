# SDLC Factory 重构讨论记录

本目录保存 2026-08-06 至 2026-08-07 围绕 Open Design、桌面工作台、多轮对话、流程命令与审核基线展开的完整设计记录。原始页面此前由本地设计服务通过 `localhost:50620` 展示，但没有进入 Git；本次将原始内容原样纳入仓库，避免后续方案再次脱离已确认的讨论。

这些文件是**决策证据与演进记录**，不是彼此同时生效的多套方案。当前设计以[《SDLC Factory 重构方案》](../../architecture/sdlc-factory-overall-design.md)为准；本目录用于说明该方案为何形成、哪些内容被保留、哪些内容已被后续决策取代。

## 决策优先级

发生冲突时按以下顺序解释：

1. 用户对后续修订版的明确确认，高于早期探索稿。
2. 2026-08-07 的 Pi SDK 运行时决策，高于早期多 CLI Runtime Kernel 设想。
3. 当前重构方案，高于本目录中的历史页面；历史页面不得单独作为实现依据。
4. v1.2 是历史实现快照，不属于本次设计方案，也不参与冲突裁决。

## 当前有效结论

- Electron 桌面工作台保留左侧项目导航、中间连续多轮对话和可收起的右侧项目面板。
- 对话按时间平铺。工具过程、文件变更、测试、预览、错误和等待用户等状态跟随对应轮次；右侧只聚合文件、变更、产物、证据、审核与基线。
- 输入框支持按轮选择模型和推理强度，支持文件选择、拖放、粘贴和多附件。
- 附件以普通项目文件呈现，后台记录来源、版本和内容摘要；不暴露额外的“受治理区域”。
- `/sdlc-*` 命令显式触发对应 Skill。Skill 开始时读取 Core 解析的项目事实，AI 在普通回复中说明缺口并推荐命令。
- 对话不绑定流程，消息不携带流程工作上下文，不建设 Core 命令拦截层，也不因阶段顺序拒绝用户继续。
- 一轮模型调用结束只表示本轮结束；等待用户、部分完成、中断或失败都可在同一对话继续，不能据此认定阶段完成。
- 只有显式 `/sdlc-review` 固化待审核版本，用户通过后才形成不可变基线。AI 不能代替用户审核。
- Pi SDK 是首版运行时；Open Design 的多 CLI daemon、CLI 探测和原生 CLI 会话模型不进入当前架构。

## 页面演进与效力

| 顺序 | 文件 | 内容 | 当前效力 |
| --- | --- | --- | --- |
| 1 | [architecture-similarity.html](visuals/architecture-similarity.html) | Open Design 与 Factory 的相似性 | 部分保留：本地工作台与权威边界；多 CLI 结论已取代 |
| 2 | [architecture-directions-v3.html](visuals/architecture-directions-v3.html) | A／B／C 架构方向，选择 B | 保留“提炼机制、重建 Core”；Runtime Kernel 具体实现已由 Pi SDK 取代 |
| 3 | [target-architecture-section-1.html](visuals/target-architecture-section-1.html) | 早期目标架构与权威边界 | 部分保留：Electron、本地 Core、SQLite、项目工作区；多 CLI 与强治理模块不生效 |
| 4 | [conversation-invocation-section-2.html](visuals/conversation-invocation-section-2.html) | 早期 Conversation、Invocation、Run 模型 | 仅作演进记录；不把对话、消息和每轮调用提升为 Factory 领域模型 |
| 5 | [runtime-resources-section-3.html](visuals/runtime-resources-section-3.html) | 运行时、资源、权限与记忆 | 部分保留：运行时隔离、权限、审计；多适配器与复杂资源模型不进入首版 |
| 6 | [governance-lifecycle-section-4.html](visuals/governance-lifecycle-section-4.html) | 早期强治理生命周期 | 仅保留显式审核、证据真实性和不可变基线；固定阶段门禁与自动推进已删除 |
| 7 | [desktop-workbench-section-5.html](visuals/desktop-workbench-section-5.html) | 第一版桌面工作台 | 已被后续第 5 节修订版取代 |
| 8 | [desktop-workbench-section-5-revised.html](visuals/desktop-workbench-section-5-revised.html) | 参考 Open Design 对话代码，补充模型、级别和附件 | 部分保留；“受治理输入区”和强阶段展示已被多轮版修正 |
| 9 | [desktop-workbench-section-5-multiturn.html](visuals/desktop-workbench-section-5-multiturn.html) | 多轮平铺、右侧聚合、附件项目化 | **当前有效的工作台交互依据** |
| 10 | [desktop-workbench-section-6-command-reminder.html](visuals/desktop-workbench-section-6-command-reminder.html) | Core 阶段提醒卡 | 中间稿；提醒卡与 Core 拦截入口已被最终版删除 |
| 11 | [waiting-command-guidance-research.html](visuals/waiting-command-guidance-research.html) | 暂停设计并研究 Claude Code Game Studios | 研究过程标记，不是设计结论 |
| 12 | [desktop-workbench-section-6-ai-guidance-final.html](visuals/desktop-workbench-section-6-ai-guidance-final.html) | Skill 读取状态、AI 普通回复提示、用户可继续 | **当前有效的命令与流程交互依据** |
| 13 | [desktop-workbench-final-handoff-20260807-v2.html](visuals/desktop-workbench-final-handoff-20260807-v2.html) | 最终工作台交付核对页 | **当前有效的最终界面表达** |

## 研究输入

- [用户提供的 Open Design 调研原文](source-opendesign-analysis.md)：原样保存的前置调研输入，其中多 CLI 与运行时相关结论已被 Pi SDK 决策取代。
- [Open Design 官方源码审计](../../research/open-design-official-source-audit-2026-08-06.md)：对官方仓库和代码的核验记录。
- [Claude Code Game Studios 工作流引导机制审计](../../research/claude-code-game-studios-workflow-guidance-audit-2026-08-06.md)：柔性流程提示的源码依据。
- [Agent 运行时选型与 Pi SDK 研究记录](../../research/agent-runtime-selection-pi-sdk-2026-08-07.md)：运行时替换决策及性能风险分析。

## 原始内容校验

以下 SHA-256 用于证明纳入仓库的内容与恢复时的本地原始文件一致：

```text
CBE945417280C8E7A458113306ECBD096DE7F291711FC869A6471DFEFF979597  source-opendesign-analysis.md
81E8C6BEE10D4AE28448CBB80DD9954206827BE78031851ABB664181C47FE9AA  visuals/architecture-similarity.html
AA69A03F625147865722CBD3136A5D8F03D9D4F06B14A6CCCE52EA5CA9ECD9CF  visuals/architecture-directions-v3.html
ED7A61AF59D3D5EA8A49F83A1C0FE1DAEF7B7B011C2CB0C5A26709D73B71776D  visuals/target-architecture-section-1.html
E14A7F1D862598F12E425CD5C70EF318500FB6255DF5307EC55157F204A660B6  visuals/conversation-invocation-section-2.html
D0055F2E8CDBF7A64ACD7B3C3C95ED9BC58B00F2F7DE1E252008DCFB82F3BC76  visuals/runtime-resources-section-3.html
27CFB79929A9E5A25B84DAB7D8730A23B17CCB5C9D35122044171CA9968DCAEE  visuals/governance-lifecycle-section-4.html
7219F7D8FEC497F152D1F4FEA1AD89F431A538F395080A7B37A554D05B78EEFB  visuals/desktop-workbench-section-5.html
768C0235BCF4AF950F9CCE0622D0E158522F30138F485C89F90CE430E179B319  visuals/desktop-workbench-section-5-revised.html
69D259443C93AE05DC5DA97BC46D7790FF747271CAA10DBFDC09377EF7A333C3  visuals/desktop-workbench-section-5-multiturn.html
56EC95868E39716DCFFC947184A746349A3C7A053771BD3B2D9A296472D140E3  visuals/desktop-workbench-section-6-command-reminder.html
1F6BC8C1230E6F7271E9A23A803FCA1845AB69087DC5ADD5BC6841EB49F735E3  visuals/waiting-command-guidance-research.html
83D7A9BED0296D50C82DA60BD103622249E3242F94810BCF67D07C9F6C7F61FD  visuals/desktop-workbench-section-6-ai-guidance-final.html
177B7837E0742F18CC7CE99B1F30F0FDE331285EF98DBEFE40265CCFA4EE7AFA  visuals/desktop-workbench-final-handoff-20260807-v2.html
```

本地 `localhost:50620` 地址及其临时访问密钥属于当时设计服务的运行状态，不是方案内容，也不进入版本库。
