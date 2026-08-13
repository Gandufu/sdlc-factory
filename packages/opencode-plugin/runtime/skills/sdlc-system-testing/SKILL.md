---
name: sdlc-system-testing
description: 用于固定当前版本、复用有效模块证据、启动完整应用并执行已有 Playwright 跨模块测试，生成系统报告和验收候选。
compatibility: opencode
metadata:
  lifecycle: system-testing
---

# 系统集成测试与验收

## 固定顺序

若已经存在已批准通过的系统测试版本，且当前总设计版本与配方记录一致，优先只调用一次
`sdlc_test_execute_existing(scopeType=SYSTEM,environmentVersionId=<本次明确环境版本>,createCandidate=true)`。
该工具复用批准记录中的原命令配方，以当前模块版本建立新系统运行，首错即停，自动形成记录和报告，并且
只在全部通过时创建系统测试候选；工具内部不调用模型。不得为“确认命令”再次装配全量上下文或逐步重构
旧测试记录。没有批准配方或总设计已经变化时，必须重新确认测试命令并执行下述固定顺序。

1. 调用 `sdlc_status`，确认全部业务模块代码和模块测试版本当前有效。
2. 用 `sdlc_context_assemble` 取得系统测试版本清单和跨模块说明，不加载所有正文或完整日志。
3. `sdlc_status` 已把代码字节和测试记录指纹校验为当前有效时，直接复用模块测试版本，不再调用
   `sdlc_test_reuse_find` 重构历史指纹或重跑单元测试；系统阶段只执行跨模块和环境相关检查。
4. 调用 `sdlc_run_start` 固定总设计、模块代码和模块测试版本。其 `command` 必须精确传
   `/sdlc-test system`，不得传 `system`、`system 模拟`、`/sdlc-test system 模拟` 或测试脚本；
   “模拟”只用于选择下述模拟环境，不属于运行命令，也不需要传 `moduleName`。
5. 所有测试、启动和检查通过 `sdlc_command_execute` 执行；应用就绪依据健康检查或进程信号，不通过固定 sleep 等待 OpenCode。
6. 检查环境版本、级别和声明地址。系统阶段复用当前有效的模块测试版本，不重复跑单元测试；但必须在
   同一系统运行中先执行项目已有的编译或打包命令，再执行已有的 Playwright 跨模块关键流程，确保
   Playwright 启动的是本次输入版本产生的构建物。若项目提供面向干净检出的总验证命令，应优先执行；
   命令不存在时不得临时虚构。Playwright 不替代单元测试，也不得现场生成全套测试。
   测试记录会自动把总设计批准的产品路径、测试路径和常见构建配置中当前存在的文件纳入指纹；
   `fingerprintPaths` 只补充本次命令实际依赖、但不在批准路径或常见配置清单中的具体文件。
   是否属于 Playwright 以已批准测试源码和受控命令的实际行为为准，不以目录或文件后缀猜测：已有
   文件导入并调用 Playwright `_electron`、启动真实 Electron 窗口并完成跨模块断言，且对应命令
   成功，即为有效证据。不得额外要求 `tests/functional/*.functional.ts` 等固定命名；例如已批准的
   `tests/verify-sdlc-contracts.ts` 若满足上述行为，其 `pnpm verify:contracts` 成功证据应直接采用。
7. 如实结束运行并创建系统测试记录；运行工具已经绑定命令证据，创建记录时不传工具返回的
   `.sdlc-factory/evidence` 内部路径，也不得把它改写成项目根目录下的 `evidence/...`；使用
   `sdlc_verification_report_generate` 从记录自动生成报告。
8. 只有必须场景全部通过且证据完整时，才能调用 `sdlc_system_test_candidate_create`。专用工具直接绑定当前系统运行、自动报告和通过记录，不得让模型重构版本清单和文件指纹。
9. `sdlc_status` 已返回 `systemTestProfile=REAL` 的有效系统测试版本且尚无系统验收版本时，才直接调用
   `sdlc_system_acceptance_candidate_create`，由工具复用已批准系统测试版本、报告和测试记录形成系统
   验收候选，然后等待用户审核。`SIMULATION` 或 `UNSPECIFIED` 只能停在系统测试版本；状态应明确显示
    本地模拟闭环已验证、真实环境测试和正式验收尚未完成，模拟结果不能形成正式系统验收。

不得直接读取 `.sdlc-factory` 或 `.opencode`，不得扫描不属于当前项目的子目录。系统范围和参与版本只使用状态及最小上下文工具返回的事实。

任何失败、跳过、阻塞或缺少真实环境证据都会阻止系统验收通过。凭据和令牌只使用引用，不得进入提示词、日志或报告。

同一运行中的同一命令最多执行两次。确定性重跑默认首错即停、不自动重试；需要修复时退出本次测试，进入
对应编码或环境处理流程，不得让模型在同一系统测试回合中无限尝试。

用户参数明确为 `system 模拟` 时，只验证插件闭环和本地跨模块行为：登记 `profile=SIMULATION` 且用途
写明“不代表真实设备验收”的模拟环境，应用地址使用应用真正加载的 Electron `app://` 完整地址，
外部接口地址使用测试代码真正构造的保留测试地址或明确的模拟地址，
不登记凭据；执行代码阶段已经维护的 Playwright 模拟流程。报告和系统测试审核投影必须保留模拟环境地址与
用途边界，不得宣称真实设备、真实 TLS 或真实凭据已经验证，也不得生成正式系统验收候选。普通
`system` 仍要求 `profile=REAL` 的真实环境证据。
已有当前模拟环境版本时直接复用，不重复登记同一事实。

自动化或人工只需重跑已有系统测试时，直接在目标项目执行：

```powershell
node .opencode\bin\sdlc-test-run.mjs system --environment <环境版本编号>
```

该入口不启动 OpenCode 模型，默认只形成测试记录，不改写当前报告；需要生成报告并进入审核时显式增加
`--candidate`。系统环境必须每次明确传入，绝不静默沿用历史真实设备或模拟地址。
