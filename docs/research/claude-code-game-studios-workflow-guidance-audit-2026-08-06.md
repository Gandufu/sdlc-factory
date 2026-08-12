# Claude Code Game Studios 流程引导机制源码审计

> 状态：源码事实保留。文中早期面向单一需求文档和旧执行单位的采用建议已经被当前模块化需求、模块化设计和分层测试方案替代；当前正式方案见 [DESIGN-02](../design/02-mvp0-sdlc-spec-design.md) 和 [DESIGN-03](../design/03-mvp0-sdlc-design-test-design.md)。

## 1. 审计范围

- 审计日期：2026-08-06
- 官方仓库：[Donchitos/Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)
- 审计分支：`main`
- 审计提交：[`984023ddac0d5e27624f2baacde6105e45de375f`](https://github.com/Donchitos/Claude-Code-Game-Studios/tree/984023ddac0d5e27624f2baacde6105e45de375f)
- 证据范围：官方 README、Skill、Agent 配置、Hook、状态栏脚本、工作流目录与官方工作流指南；未使用第三方介绍文章。

本文重点回答：当前设计或其他前置阶段尚未完成时，用户直接执行后续 Slash Skill，Claude Code Game Studios 如何识别阶段与缺口、如何推荐下一命令、是否存在统一硬门禁，以及哪些停止行为只是单个 Skill 缺少实际输入。

## 2. 结论摘要

1. **项目采用“阶段提示 + 产物检测 + 命令推荐”，没有全局生命周期状态机拦截所有 Slash Skill。** `production/stage.txt` 是显式阶段记录；不存在时再根据项目产物推断阶段。[/help 阶段解析](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/help/SKILL.md#L53-L73) [/project-stage-detect 阶段解析](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/project-stage-detect/SKILL.md#L60-L75)

2. **`/gate-check` 的结论是建议，不是系统级硬阻断。** Skill 源码明确要求“Never block a user from advancing”，即输出风险和补救命令后由用户决定是否继续。[/gate-check 协作规则](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/gate-check/SKILL.md#L527-L542) 工作流目录也明确说明 Gate verdict 为 `ADVISORY`。[/workflow-catalog 说明](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/docs/workflow-catalog.yaml#L1-L15)

3. **没有统一的“Slash 命令执行前阶段 Hook”。** `settings.json` 只配置了 SessionStart、Bash 工具前校验、Write/Edit 后校验、压缩、通知和会话/子智能体结束等 Hook；没有对所有用户 Slash 输入统一做阶段匹配的 `UserPromptSubmit` 或等价拦截器。[/settings.json Hook 配置](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/settings.json#L34-L83)

4. **某个具体 Skill 可以因为缺少自身必不可少的输入而停止，但这不是“前一阶段未结束所以禁止下一阶段”的通用门禁。** 例如 `/dev-story` 缺少需求追踪注册表或治理 ADR 时停止；缺少控制清单则只警告并继续；依赖故事未完成时让用户选择继续或停止。[/dev-story 输入检查](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/dev-story/SKILL.md#L42-L52) [/dev-story 依赖选择](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/dev-story/SKILL.md#L98-L115)

5. **命令之间以“提示下一命令、等待用户再次输入”衔接，不自动串行运行。** `/start` 明确规定不能自动运行下一 Skill，只能告诉用户输入推荐命令。[/start 交接规则](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/start/SKILL.md#L211-L245)

因此，对 `sdlc-factory` 最值得参考的不是一套复杂流程引擎，而是下面这个简单模式：

```text
执行 /sdlc-* 前
  -> 当前 Skill 读取 Core 提供的阶段与已有产物
  -> AI 找出尚未完成的推荐步骤
  -> AI 在对话中显示缺口和建议命令
  -> 用户仍可选择继续当前命令
  -> 只有命令缺少不可替代输入时，才报告“当前无法执行”
```

## 3. 当前阶段如何确定

### 3.1 显式阶段优先

`/help` 首先读取 `production/stage.txt`，并把它称为权威阶段；只有文件缺失时，才按代码量、故事、ADR、系统索引、游戏概念等产物，从最靠后的阶段向前推断。[/help：显式阶段与回退推断](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/help/SKILL.md#L53-L73)

`/project-stage-detect` 使用同样原则：`production/stage.txt` 存在则作为 `/gate-check` 写入的显式覆盖，否则按产物启发式分类。[/project-stage-detect：分类规则](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/project-stage-detect/SKILL.md#L60-L75)

状态栏也只是读取并显示这一阶段：优先读取 `stage.txt`，否则检查概念、系统索引、引擎配置、ADR 和源文件数量后推断。它不执行流程迁移，也不阻止命令。[/statusline.sh：阶段显示](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/statusline.sh#L32-L87)

### 3.2 阶段状态不是从对话推断

这套实现没有“对话绑定流程”或“每条消息携带流程上下文”。阶段来自一个小型阶段文件和项目产物。会话状态文件 `production/session-state/active.md` 用来恢复最近工作与显示正在进行的事项，`/help` 读取它只是为了个性化提示，不把它当作生命周期权威。[/help：读取会话上下文](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/help/SKILL.md#L77-L85)

### 3.3 没有独立的“命令是否仍在运行”状态机

官方实现主要依靠 Skill 自己输出 `COMPLETE`、`BLOCKED` 等文字结论、增量写入产物，以及 `production/session-state/active.md` 记录最近工作。以 `/design-system` 为例，中断恢复时读取 `active.md` 和 GDD 内容：有真实内容的章节视为已完成，仍为 `[To be designed]` 的章节视为未完成，然后从下一缺口继续。[/design-system：恢复与继续](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/design-system/SKILL.md#L817-L828)

因此它判断的是“产物还缺什么”，不是维护一个中央命令运行状态机。Factory 也没有必要为了阶段提醒建立复杂执行编排；只要在执行新命令前读取当前阶段和可验证缺口即可。

## 4. 如何判断哪些流程没有完成

### 4.1 工作流目录声明步骤和产物条件

`.claude/docs/workflow-catalog.yaml` 是 `/help` 使用的流程目录，按阶段列出有序步骤，并为步骤标记：

- `required: true/false`：必需或可选；
- `artifact.glob`：期望存在的文件；
- `artifact.pattern`：文件内必须出现的内容；
- `min_count`：最低文件数量；
- `note`：无法自动判断时交给人工确认；
- `repeatable`：每个系统、故事等可重复执行。

目录本身对系统设计阶段的描述就是：逐个完成系统 GDD、逐个设计审核、整体 GDD 交叉审核；这些步骤分别关联 `/design-system`、`/design-review` 和 `/review-all-gdds`。[/workflow-catalog：系统设计阶段](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/docs/workflow-catalog.yaml#L69-L103)

### 4.2 `/help` 找出第一项未完成的必需步骤

`/help` 对当前阶段逐项检查产物：存在且满足数量、模式即完成；缺少即未完成；无法自动检查则标记 `MANUAL`；没有检测条件则标记 `UNKNOWN`。[/help：完成度检查](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/help/SKILL.md#L89-L126)

随后它提取：

1. 最后一个已确认完成的步骤；
2. 第一项未完成的必需步骤，作为当前主要提醒；
3. 当前可做的可选步骤；
4. 后续必需步骤。

[/help：定位下一步](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/help/SKILL.md#L129-L143)

输出刻意保持简短：显示已完成项、唯一的“下一项必需步骤”及其 Slash 命令、可选项和后续步骤；不自动运行命令。[/help：输出格式](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/help/SKILL.md#L154-L200) [/help：禁止自动执行](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/help/SKILL.md#L221-L228)

### 4.3 `/project-stage-detect` 是更完整的缺口审计

`/project-stage-detect` 扫描设计文档、源码、生产产物、原型、架构文档和测试，统计产物数量与完整度。[/project-stage-detect：扫描范围](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/project-stage-detect/SKILL.md#L22-L59)

它不只罗列缺文件，而是要求 AI 对歧义提出问题，例如发现代码存在但设计文档缺失时，询问是先做了原型还是需要执行 `/reverse-document`；发现概念存在但系统索引缺失时，建议 `/map-systems`。[/project-stage-detect：协作式缺口识别](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/project-stage-detect/SKILL.md#L76-L84)

最终报告包含阶段、各领域完整度、缺口和按优先级排列的建议步骤，并要求用户批准后才写报告文件。[/project-stage-detect：报告和批准](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/project-stage-detect/SKILL.md#L86-L110) [/project-stage-detect：推荐命令](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/project-stage-detect/SKILL.md#L172-L195)

## 5. 当设计未完成却执行下一阶段命令时，真实行为是什么

### 5.1 不存在统一的“命令前阶段阻断”

README 明确允许用户不经过 `/start`，直接跳到自己需要的 Skill。[/README：允许直接进入具体 Skill](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/README.md#L151-L164)

官方 `settings.json` 也没有为 Slash 输入配置统一阶段检查。SessionStart 只执行 `session-start.sh` 和 `detect-gaps.sh`；PreToolUse 只在 Bash 工具调用时运行提交、推送校验；PostToolUse 只在 Write/Edit 后做资产和 Skill 变更检查。[/settings.json：Hook 触发点](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/settings.json#L34-L83)

因此不能把官方实现描述成：每个后续 Slash Skill 执行前，系统都会自动跑一遍完整阶段 Gate。源码中没有这样的统一拦截器。

### 5.2 通常由目标 Skill 自己检查其必要输入

后续 Skill 会读取自己的工作输入，缺失时分别采取三种行为。

#### A. 缺少不可替代输入：停止并推荐前置命令

- `/create-architecture` 未配置引擎时停止，并提示先运行 `/setup-engine`。[/create-architecture：引擎缺失](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/create-architecture/SKILL.md#L36-L57)
- `/design-system` 缺少游戏概念或系统索引时失败，并分别提示 `/brainstorm`、`/map-systems`。[/design-system：必要输入](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/design-system/SKILL.md#L70-L82)
- `/create-stories` 引用的 ADR 文件不存在时立即停止，并提示修正引用或执行 `/architecture-decision`。[/create-stories：ADR 文件缺失](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/create-stories/SKILL.md#L43-L61)
- `/dev-story` 缺少需求追踪注册表或治理 ADR 时停止，不启动程序员 Agent。[/dev-story：不可替代输入](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/dev-story/SKILL.md#L42-L54)

这些停止都是“当前命令没有足够输入，继续会失真”，而不是“阶段编号不对，所以一律禁止执行”。

#### B. 有风险但仍可工作：警告后继续

- `/design-system` 发现上游依赖尚未设计时，提示会产生接口假设，并让用户选择先设计依赖，或继续并把契约标为临时。[/design-system：上游设计缺口](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/design-system/SKILL.md#L94-L140)
- `/create-epics` 发现需求没有 ADR 覆盖时，说明 Epic 仍可创建，只是相关 Story 会被标记阻塞；用户可以先运行 `/architecture-decision`，也可以接受占位符继续。[/create-epics：追踪缺口与继续选项](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/create-epics/SKILL.md#L90-L125)
- `/dev-story` 缺少控制清单时只是 `WARN and continue`；故事依赖未完成时则让用户选择“接受风险继续”或“先停止完成依赖”。[/dev-story：警告与用户裁决](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/dev-story/SKILL.md#L42-L52) [/dev-story：依赖未完成](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/dev-story/SKILL.md#L98-L115)

#### C. 只做阶段建议：不阻止用户

`/gate-check` 检查阶段所需产物和质量，输出 `PASS`、`CONCERNS` 或 `FAIL`，并为每个阻塞项给出具体补救命令。[/gate-check：结论格式](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/gate-check/SKILL.md#L360-L382) [/gate-check：补救命令映射](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/gate-check/SKILL.md#L489-L523)

但它同时明确规定：

- 结论只是建议；
- 用户作最终决定；
- 不自动补齐产物；
- 不自动重跑 Gate；
- 永远不能阻止用户前进，只记录风险。

[/gate-check：建议性 Gate](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/gate-check/SKILL.md#L527-L542)

### 5.3 `stage.txt` 的更新比命令调用更严格

Gate 只有在结论为 `PASS` 且用户确认要推进时，才更新 `production/stage.txt`；写入前仍须再次询问用户。[/gate-check：PASS 后更新阶段](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/gate-check/SKILL.md#L429-L442)

这意味着：

- 用户可以直接调用后续 Skill；
- 但项目的“推荐阶段”不会因为调用了后续 Skill 就自动改变；
- 阶段前进仍需要显式 Gate 结论与用户确认；
- 阶段记录用于状态栏和后续 `/help`，不是命令执行锁。

## 6. Hook 到底做什么

### 6.1 `detect-gaps.sh` 是会话启动提醒

该 Hook 在 SessionStart 执行，检测：

- 新项目没有引擎、概念和源码时，建议 `/start`；
- 代码很多但设计文档稀少时，建议 `/reverse-document`；
- 原型无说明、核心代码无架构文档、玩法系统无 GDD、代码很多但无生产计划等缺口。

[/detect-gaps.sh：新项目提示](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/hooks/detect-gaps.sh#L1-L44) [/detect-gaps.sh：设计与代码缺口](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/hooks/detect-gaps.sh#L46-L68) [/detect-gaps.sh：架构与玩法缺口](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/hooks/detect-gaps.sh#L97-L148)

脚本采用 `set +e`，末尾固定 `exit 0`。它的功能是把提醒文本注入会话，不阻断会话或命令。[/detect-gaps.sh：非阻断退出](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/hooks/detect-gaps.sh#L7-L10) [/detect-gaps.sh：正常退出](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/hooks/detect-gaps.sh#L150-L155)

### 6.2 其他 Hook 不是生命周期门

`session-start.sh` 展示分支、最近提交、当前 Sprint、缺陷数和上次会话状态；它同样以 `exit 0` 结束。[/session-start.sh](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/hooks/session-start.sh#L1-L75)

提交、推送、资产与 Skill 变更 Hook 是工具级安全和质量校验，不负责判断“设计阶段结束了吗”。README 也说明可选工具缺失时 Hook 会优雅失效，只会失去校验，不让系统整体不可用。[/README：Hook 优雅失效](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/README.md#L134-L143)

## 7. 命令之间如何衔接

### 7.1 每个 Skill 声明自己前后的命令

例如：

- `/create-stories` 写明前一步是 `/create-epics`，后一步是 `/story-readiness` 再到 `/dev-story`。[/create-stories：前后步骤](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/create-stories/SKILL.md#L18-L25)
- `/dev-story` 在文件开头展示 `/qa-plan` → `/story-readiness` → `/dev-story` → `/code-review` → `/story-done` 的故事循环。[/dev-story：故事循环](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/dev-story/SKILL.md#L10-L25)
- `/design-system` 完成后显示一致性检查、下一个系统、修复审核问题、停止或 Gate 检查等选项。[/design-system：完成后的推荐](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/design-system/SKILL.md#L760-L782)

### 7.2 推荐不等于自动运行

`/start` 明确要求：先展示推荐路径，让用户选择；用户确认后只回复“输入 `[skill command]` 开始”，不能自动运行下一 Skill。[/start：显式交接](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/start/SKILL.md#L211-L245)

`/help` 也要求永远不自动运行下一 Skill，只给一个主要建议，由用户自行调用。[/help：一个主要建议](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/skills/help/SKILL.md#L221-L228)

因此命令衔接的本质是“文件状态 + 推荐文本 + 用户再次调用”，不是后台编排器自动推进阶段。

## 8. `required`、`BLOCKED`、`FAIL` 与“不硬阻断”的语义差异

官方材料中确实存在容易误读的措辞：

- `workflow-catalog.yaml` 注释把 `required: true` 描述为“blocks progression to next phase”；[/workflow-catalog：required 注释](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/.claude/docs/workflow-catalog.yaml#L4-L15)
- 官方工作流指南称 `FAIL blocks advancement`；[/WORKFLOW-GUIDE：Gate 说明](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/984023ddac0d5e27624f2baacde6105e45de375f/docs/WORKFLOW-GUIDE.md#L1312-L1331)
- 但同一个工作流目录随即说明 Gate 只是 `ADVISORY`，用户总是可以决定继续；
- `/gate-check` Skill 的最终、可执行指令明确写着“Never block a user from advancing”。

结合源码，合理解释是：

1. `required` 决定 `/help` 把哪一项显示为“当前必须优先完成”；
2. 缺少必需项会使 Gate 给出 `FAIL`，且不会按正常 PASS 路径更新 `stage.txt`；
3. `BLOCKED` 可以是某个故事或具体 Skill 的工作状态；
4. 这些词不代表存在一个统一执行层，禁止用户调用下一阶段 Slash Skill；
5. 真正的执行停止只发生在具体 Skill 判断其必要输入缺失时，或者用户主动选择停止。

由于官方文档在自然语言上存在这处张力，本文以 Skill 源码和 Hook 配置作为最高优先级证据。可以确认“没有统一硬门禁”，但不能把所有 `STOP` 都解释成纯提醒；具体命令缺少必要输入时，官方实现确实会停止该命令。

## 9. 对 sdlc-factory 的直接设计建议

### 9.1 应当保留的最小机制

Factory 不需要引入对话模型、消息流程上下文、流程绑定、统一命令拦截器或通用工作流引擎。只需让每个 `/sdlc-*` Skill 在开始工作前读取插件已有的阶段、产物和审核事实，再由 AI 判断是否需要提醒：

1. 当前 Skill 调用只读状态查询；
2. AI 发现前序工作明显未完成时，列出缺口和对应 Slash 命令；
3. AI 在对话中询问用户继续当前命令，还是先执行建议命令；
4. 用户选择继续后，当前 Skill 正常执行；
5. 只有缺少该命令不可替代的实际输入时，才报告当前无法执行。

建议的提示格式：

```text
当前建议阶段：设计

尚未完成：
- 系统管理设计未审核 → 建议 /sdlc-review 系统管理
- 总体设计仍有 2 个未决项 → 建议 /sdlc-design

你正在执行：/sdlc-code 系统管理
继续执行可能基于未确认设计产生返工。

你可以选择继续执行，也可以先运行上面的建议命令。
```

这里的“尚未完成”是 AI 根据插件事实给出的建议信息，不是硬门禁拒绝，也不需要单独设计产品拦截卡。

### 9.2 只在三类情况真正拒绝执行

1. 命令目标不存在或参数无效；
2. 缺少命令不可替代的输入，继续执行没有确定语义；
3. 涉及安全、数据完整性或正式审核/基线事务，必须满足既定约束。

“上一阶段未全部结束”本身不应成为第四类拒绝原因。

### 9.3 不应照搬的部分

- 不照搬 7 阶段、73 个 Skill 和大量目录约定；
- 不照搬“AI 扫 Markdown 推断一切”的非确定性实现；Factory 插件直接读取目标项目中的结构化阶段事实，并辅以工作区产物检测；
- 不把 `required` 实现成阻断命令的硬权限；
- 不自动执行推荐命令；
- 不因用户执行了后续命令就自动宣告前一阶段完成或推进阶段；
- 不为这一需求新增对话或消息领域模型。

### 9.4 建议吸收的核心原则

> 阶段用于定位与建议，命令用于显式触发工作；阶段不合适时先说明缺口和推荐命令，但是否继续由用户决定。只有当前命令缺少不可替代输入时，才停止当前命令。

这才是 Claude Code Game Studios 当前源码中值得 Factory 复用的轻量机制，而不是构建一个强制门禁系统。

## 10. 不确定性与限制

1. 仓库是 Claude Code 提示词、Skill 与 Shell Hook 模板，不是带中央服务端 Core 的产品；“执行”最终仍由 Claude 遵循 Skill 指令完成。因此源码能证明没有配置统一 Hook，但不能证明模型在所有实际运行中百分之百遵循提示词。
2. 官方工作流指南使用了“FAIL blocks advancement”，而 Gate Skill 又明确要求永不阻止用户前进；本文按可执行 Skill 和 Hook 配置解释为“不给 PASS、不按正常路径更新推荐阶段，但不禁止直接调用后续 Skill”。
3. 个别 Skill 对必需输入采用 `STOP`，个别采用警告并允许继续，当前仓库并未把这一策略抽象成统一机器可执行规则；Factory 若参考，应统一成简单、确定性的 Core 返回结果。
