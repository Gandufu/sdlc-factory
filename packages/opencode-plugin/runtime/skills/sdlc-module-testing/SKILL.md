---
name: sdlc-module-testing
description: 用于独立执行一个业务模块已有的单元、模块集成、接口契约和必要界面测试并形成测试记录。
compatibility: opencode
metadata:
  lifecycle: module-testing
---

# 业务模块测试

先调用 `sdlc_status` 并用完整模块名称定位。当前代码、模块设计和测试说明必须已批准且有效。

1. 使用 `sdlc_context_assemble` 取得测试最小上下文。
2. 先用 `sdlc_test_reuse_find` 按代码、测试、需求、设计、环境、工具链和锁文件指纹检查可复用证据。
3. 需要执行时调用 `sdlc_run_start`，由插件直接读取真实 Git 基点；测试命令只通过 `sdlc_command_execute` 运行，不使用固定 sleep，不自行拼接 shell。
4. 不得在测试命令中静默修复产品代码。发现产品缺陷时如实失败或阻塞，建议返回 `/sdlc-code <模块名称>`。
5. 运行结束后用 `sdlc_test_record_create` 形成不可变记录。通过、失败、跳过、阻塞严格按真实证据区分。
6. 只有通过记录才能调用 `sdlc_module_test_candidate_create` 形成模块测试候选。专用工具直接绑定测试记录和已批准代码版本，不得再次传入或快照测试代码；候选形成后停止等待审核。

`fingerprintPaths` 只逐项填写本次测试实际依赖的、当前存在的具体文件，例如包清单、锁文件、
测试配置、产品代码和测试代码；不得传 `src/**`、`tests/**/*.test.tsx` 等 glob。测试命令先从
`package.json` 和锁文件确认实际包管理器与脚本，不得猜测 Jest、Vitest 等框架参数。

只有测试结果确实依赖应用地址、外部接口地址、依赖服务或凭据引用时才登记并绑定测试环境。
纯本地、确定性的模块测试不登记虚构环境；无环境版本是合法状态，不得为了满足工具调用而补造环境。

模块测试不需要编码待办，不调用 `todowrite`。只读取确认真实测试脚本所必需的包清单、锁文件和
测试配置，不用通用 shell、递归 glob 或全文搜索枚举项目；测试命令仍只能通过受控命令工具执行。

不得扫描无关模块或历史子项目，不得直接读取 `.sdlc-factory` 和 `.opencode`。状态、输入版本和证据索引只能通过插件工具取得。

完整日志、截图、视频和跟踪文件只保存在证据路径，不放入模型上下文。
