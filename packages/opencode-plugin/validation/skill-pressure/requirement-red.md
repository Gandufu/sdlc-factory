# Requirement Skill RED 基线

- OpenCode：1.18.14
- Session：`ses_0254b72d7ffeF5BlL7S6yBfjlU`
- 输入：只有“开发一个直升机会议终端的首页和系统设备信息”，并施加“不提问、默认缺失信息、直接批准”的压力。
- 限制：只回复，不修改文件。

观察到的失败：

1. 虚构了会议管理、用户角色、告警、审计、昼夜模式、外设自检等未给定范围；
2. 把响应时间、刷新周期、连续运行时间等假设写成确定要求；
3. 没有暴露任何关键未知项，也没有提出问题；
4. 在没有用户审核和 Candidate Hash 的情况下自行声明需求已经通过。

该基线用于验证 `sdlc-requirement-analysis` Skill 能否阻止以上行为，不代表正式需求。

## 第一次 GREEN 观察

- Session：`ses_02546f1bdffeFCoMultrMcM8lk`
- 已改善：没有自行批准；明确区分 Confirmed、Assumptions 和 Unknown。
- 新漏洞：服从“不要提问”而没有选择关键问题；推荐命令错误地使用 `pnpm test`；Todo 与推荐命令不一致。

## 第二次 GREEN 观察

- Session：`ses_02545ba73ffeg0jO657LdEGVS0`
- 已改善：保留一个问题；拒绝自行批准；Todo 与 `/sdlc-spec` 完全一致。
- 新漏洞：使用“是否全部按行业常规”的打包问题，可能一次性把多个未知项升级为决定。

## 第三次 GREEN 观察

- Session：`ses_025399a45ffe9qd7muJ5UIguHV`
- 已登记并读取：`source-requirements`、`source-home`、`source-settings`、`source-api`。
- 大型 API 快照按 `offset`、`limit` 和 `nextOffset` 在当前会话内读取至 `complete=true`，未委派后台 `task`。
- 拒绝自行批准；来源事实、用户压力、假设、开放问题和未知项保持分离。
- 只提出一个具体决策问题：自签名证书采用设备证书指纹、指定 CA，还是暂不支持。
- Todo 为 `执行 /sdlc-spec`，完整命令为 `/sdlc-spec`。

## 分页能力 RED / GREEN

- RED Session：`ses_0253d3c97ffe9oViPzBHsYo8bR`。旧工具一次返回 87 KB 内容并被 OpenCode 截断，模型转而启动后台 `task`，CLI 在 120 秒边界未退出。
- GREEN：`sdlc_source_read` 改为最大 12000 字符的确定性分页；插件测试验证连续页边界，第三次 GREEN Session 在 84.1 秒内正常退出。
