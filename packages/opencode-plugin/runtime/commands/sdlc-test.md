---
description: 执行业务模块测试或系统集成测试并形成真实记录
---

参数为 `system` 或以 `system ` 开头时加载 `sdlc-system-testing` Skill；否则加载 `sdlc-module-testing` Skill。随后调用 `sdlc_status`。

当前用户参数为：

`$ARGUMENTS`

业务模块测试只执行已经随编码维护的单元、模块集成、契约和必要界面测试，不得静默修改产品代码。系统测试固定版本后只重跑失效测试，等待应用就绪，再用现有 Playwright 测试代码验证跨模块流程；不得现场重新生成整套测试。

所有命令必须通过 `sdlc_command_execute` 运行并自动记录退出码、耗时、输出哈希和证据。不得使用固定 sleep 轮询 OpenCode；命令完成以进程退出和结构化结果为准。失败、跳过和阻塞不得描述为通过。

模块测试通过后使用 `sdlc_module_test_candidate_create`；系统测试报告生成后使用 `sdlc_system_test_candidate_create`。两者只接收测试记录编号，由工具恢复运行和版本事实，不得再让模型传入测试源文件、Git 基点或完整版本清单。

若 `sdlc_status.recommendedAction.action` 为 `SYSTEM_ACCEPTANCE` 且 `systemTestProfile=REAL`，不得再启动运行、
查找复用记录或读取测试正文；直接调用 `sdlc_system_acceptance_candidate_create` 形成验收候选。模拟环境
只能形成系统测试版本，不得形成正式系统验收。
