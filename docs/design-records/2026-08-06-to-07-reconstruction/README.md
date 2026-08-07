# SDLC Factory 重构讨论记录

本目录保存 2026-08-06 至 2026-08-07 围绕 Open Design、桌面工作台、多轮对话、流程命令与审核基线展开的 brainstorming 记录。原始页面此前由本地设计服务通过 `localhost:50620` 展示，后来为了保留探索过程而纳入 Git。

这些 HTML 和分析稿没有完成“正式 Markdown 成稿、用户审阅、用户明确确认”的正式化流程，因此不是需求、设计、决策记录或正式约定。它们只能说明曾经探索过什么，不能证明用户接受了其中任何具体方案。

当前方案以仓库根目录的[《SDLC Factory 总体需求与分阶段方案》](../../../README.md)及经用户确认的 MVP0/MVP1 子文档为准。本目录内容只有被正式文档明确采用并再次经用户确认后，才对实现产生约束。

## 非权威声明

使用本目录时必须遵守：

1. 页面被展示、讨论、生成或提交到 Git，都不等于用户确认；
2. 页面中的“A/B/C 选择”“最终版”“当前有效”等字样只是当时 brainstorming 的页面文案，现在不具有规范含义；
3. 不得从页面反向推导当前需求、运行时、界面或领域模型；
4. 研究事实应回到对应官方源码审计核实；
5. 与正式 README 或子文档冲突时，无条件以正式文档和用户后续指令为准。

## 讨论中反复出现的主题

这些页面曾讨论 Electron 工作台、多轮对话、附件、`/sdlc-*` 命令、审核、Baseline、运行时和资源治理。此列表只用于检索历史材料，不表示这些主题的具体实现已经确认。当前采用内容必须查看根 README 和正式子文档。

## 页面演进与效力

| 顺序 | 文件 | 内容 | 记录状态 |
| --- | --- | --- | --- |
| 1 | [architecture-similarity.html](visuals/architecture-similarity.html) | Open Design 与 Factory 的相似性 | brainstorming，非规范 |
| 2 | [architecture-directions-v3.html](visuals/architecture-directions-v3.html) | A／B／C 架构方向 | brainstorming，非规范 |
| 3 | [target-architecture-section-1.html](visuals/target-architecture-section-1.html) | 早期目标架构与权威边界 | brainstorming，非规范 |
| 4 | [conversation-invocation-section-2.html](visuals/conversation-invocation-section-2.html) | Conversation、Invocation、Run 探索 | brainstorming，非规范 |
| 5 | [runtime-resources-section-3.html](visuals/runtime-resources-section-3.html) | 运行时、资源、权限与记忆 | brainstorming，非规范 |
| 6 | [governance-lifecycle-section-4.html](visuals/governance-lifecycle-section-4.html) | 强治理生命周期探索 | brainstorming，非规范 |
| 7 | [desktop-workbench-section-5.html](visuals/desktop-workbench-section-5.html) | 第一版桌面工作台 | brainstorming，非规范 |
| 8 | [desktop-workbench-section-5-revised.html](visuals/desktop-workbench-section-5-revised.html) | 工作台修订探索 | brainstorming，非规范 |
| 9 | [desktop-workbench-section-5-multiturn.html](visuals/desktop-workbench-section-5-multiturn.html) | 多轮与附件探索 | brainstorming，非规范 |
| 10 | [desktop-workbench-section-6-command-reminder.html](visuals/desktop-workbench-section-6-command-reminder.html) | 阶段提醒探索 | brainstorming，非规范 |
| 11 | [waiting-command-guidance-research.html](visuals/waiting-command-guidance-research.html) | Claude Code Game Studios 研究过程标记 | brainstorming，非规范 |
| 12 | [desktop-workbench-section-6-ai-guidance-final.html](visuals/desktop-workbench-section-6-ai-guidance-final.html) | AI 柔性提示探索 | brainstorming，非规范 |
| 13 | [desktop-workbench-final-handoff-20260807-v2.html](visuals/desktop-workbench-final-handoff-20260807-v2.html) | 工作台核对页 | brainstorming，非规范 |

## 研究输入

- [用户提供的 Open Design 调研原文](source-opendesign-analysis.md)：原样保存的前置调研输入，不是当前设计。为保持下方 SHA-256 不变，其正文中的历史绝对路径不修订，也不参与当前仓库的 Markdown 链接有效性校验。
- [Open Design 官方源码审计](../../research/open-design-official-source-audit-2026-08-06.md)：对官方仓库和代码的核验记录。
- [Claude Code Game Studios 工作流引导机制审计](../../research/claude-code-game-studios-workflow-guidance-audit-2026-08-06.md)：柔性流程提示的源码依据。
- [Agent 运行时选型与 Pi SDK 研究记录](../../research/agent-runtime-selection-pi-sdk-2026-08-07.md)：研究事实保留，Pi 首版结论已被后续 OpenCode 决策替代。

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
