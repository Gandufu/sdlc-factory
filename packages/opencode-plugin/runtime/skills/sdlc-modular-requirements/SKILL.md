---
name: sdlc-modular-requirements
description: 用于从原始描述或真实资料建立产品概述、需求地图、模块需求、外部接口需求、非功能需求和总需求版本。
compatibility: opencode
metadata:
  lifecycle: requirements
---

# 模块化需求论证

## 不可跳过的顺序

1. 调用 `sdlc_status` 恢复事实；有未变化候选时停止写作并建议审核。
2. 通过 `sdlc_source_read` 读取已登记资料，不得凭产品名称补全事实。首次读取使用 `limit=12000`；仅当返回 `complete=false` 时，才从 `nextOffset` 继续，不得把小资料机械切成许多小页。
3. 区分来源事实、用户决定、待确认推断、开放问题和未知。
4. 先形成简短产品概述，再建立同层级业务模块。一级业务域是模块；页面、技术层、表和开发步骤不是模块。“用户管理”通常是“系统管理”的功能组。
5. 需求地图必须结构化声明业务模块、功能组、执行依赖、外部接口和非功能需求作用范围，并通过 `sdlc_candidate_create` 校验。
6. 每次只处理一个模块或一类跨模块需求。存在重大歧义时只问一个问题，提供两到三个候选和推荐理由。
7. 每条需求使用稳定编号，只表达一个可观察结果，关联来源和验证方法；未知阈值不得写成行业默认值。
8. 模块、接口和非功能需求逐项批准后，使用 `sdlc_set_candidate_create` 生成精确总需求版本。

需求阶段的读取边界是硬约束：

- Skill 工具已经返回完整内容后，不得再读取它自己的 `SKILL.md`；
- 不得用 `glob`、`grep` 或目录遍历扫描整个工作区；
- 不得直接读取 `.sdlc-factory`、`.opencode`、其他子项目、产品源码或历史测试目录；
- 项目事实只通过 `sdlc_status` 读取，原始资料只通过 `sdlc_source_read` 读取；
- 已批准需求上下文只通过 `sdlc_context_assemble` 装配；
- 当前工作草案只读取本轮明确要维护的 `docs/requirements` 文件。

如果目标脚手架事实会影响实现，只记录为设计阶段输入，不在需求阶段提前扫描源码。

## 文档合同

- `docs/requirements/product-brief.md`
- `docs/requirements/requirement-map.md`
- `docs/requirements/modules/<模块路径名>/functional-requirements.md`
- `docs/requirements/interfaces/<接口路径名>.md`
- `docs/requirements/quality/global.md` 或模块文件
- `docs/requirements/requirement-set.yaml`（系统生成）

创建普通候选前必须先用 `sdlc_document_write` 写入该产物规定的唯一文档，再把该文档作为 `subjectPaths`。不得省略目标文档，不得借用产品概述或其他文件占位。只有总需求版本由 `sdlc_set_candidate_create` 直接生成 YAML 和候选。

候选校验使用以下必要章节名。写作时可以增加编号，但标题必须包含这些词，避免写完后重复改名：

- 产品概述：产品目标、系统边界、主要角色、业务模块、未知；
- 需求地图：业务模块、功能组、执行依赖、外部接口、非功能需求；
- 模块需求：模块目标、范围、角色、功能组、需求条目、异常、依赖模块、外部接口、非功能需求、验证、来源、修订；
- 接口需求：业务用途、输入、输出、错误、认证、超时、数据、业务模块、验证、来源；
- 非功能需求：稳定编号、作用范围、目标、验证方法、来源。

不得创建第二份需求分析报告。正文用中文；稳定编号、路径、协议字段和代码标识使用英文。

## 结束规则

候选创建前解决本轮关键问题，或把它明确保存为未知。候选创建后不得再提出新问题或继续写其他需求，必须原样采用候选工具返回的 `recommendedAction`：一个建议动作、一条纯文本“执行 <完整命令>”待办和一条完整 `/sdlc-review` 命令，然后停止。不得自动执行。
