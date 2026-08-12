---
name: sdlc-system-testing
description: 用于固定当前版本、复用有效模块证据、启动完整应用并执行已有 Playwright 跨模块测试，生成系统报告和验收候选。
compatibility: opencode
metadata:
  lifecycle: system-testing
---

# 系统集成测试与验收

## 固定顺序

1. 调用 `sdlc_status`，确认全部业务模块代码和模块测试版本当前有效。
2. 用 `sdlc_context_assemble` 取得系统测试版本清单和跨模块说明，不加载所有正文或完整日志。
3. 按完整指纹复用有效模块记录，只重跑失效或受影响测试。
4. 调用 `sdlc_run_start` 固定总设计、模块代码和模块测试版本。
5. 所有测试、启动和检查通过 `sdlc_command_execute` 执行；应用就绪依据健康检查或进程信号，不通过固定 sleep 等待 OpenCode。
6. 检查环境版本和实际接口地址，再运行已有的非浏览器检查和 Playwright 跨模块关键流程。Playwright 不替代单元测试，也不得现场生成全套测试。
7. 如实结束运行并创建系统测试记录；使用 `sdlc_verification_report_generate` 从记录自动生成报告。
8. 只有必须场景全部通过且证据完整时，才能调用 `sdlc_system_test_candidate_create`。专用工具直接绑定当前系统运行、自动报告和通过记录，不得让模型重构版本清单和文件指纹。
9. `sdlc_status` 已返回有效的系统测试版本且尚无系统验收版本时，直接调用 `sdlc_system_acceptance_candidate_create`，由工具复用已批准系统测试版本、报告和测试记录形成系统验收候选，然后等待用户审核。此阶段不得调用 `sdlc_test_reuse_find`、不得重构历史命令或指纹参数、不得重新执行测试。

不得直接读取 `.sdlc-factory` 或 `.opencode`，不得扫描不属于当前项目的子目录。系统范围和参与版本只使用状态及最小上下文工具返回的事实。

任何失败、跳过、阻塞或缺少真实环境证据都会阻止系统验收通过。凭据和令牌只使用引用，不得进入提示词、日志或报告。
