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
6. 只有通过记录才能形成模块测试候选；候选形成后停止等待审核。

不得扫描无关模块或历史子项目，不得直接读取 `.sdlc-factory` 和 `.opencode`。状态、输入版本和证据索引只能通过插件工具取得。

完整日志、截图、视频和跟踪文件只保存在证据路径，不放入模型上下文。
