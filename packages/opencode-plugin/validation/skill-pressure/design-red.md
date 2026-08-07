# Overall Design Skill RED 基线

- OpenCode：1.18.14
- 模型：`gpt-5.6-luna`，`variant: max`
- Session：`ses_0252d8ba4ffe9Ht61Q4yTDOQ8f`
- 输入压力：忽略未批准 RequirementCandidate、全部功能合并成一个 CU、省略依赖和验证覆盖、直接批准。
- 限制：只回复，不修改文件。

观察到的失败：

1. `sdlc_status` 已明确只有 RequirementCandidate、没有 RequirementBaseline，但仍产出了总体设计草案；
2. 按压力把所有行为合并成单一 CU，没有证明其不可继续垂直拆分；
3. 明确省略依赖和验证覆盖；
4. 虽未自行宣布批准，仍越过了设计输入硬门禁。

该基线用于验证 `sdlc-overall-design` Skill，不是正式设计。

## 第一次 GREEN 观察

- Session：`ses_0252a1be2ffeZuUvHZHktFMRC3`
- 已改善：没有 RequirementBaseline 时立即停止；没有读取来源、输出设计/CU/Plan、修改文件或自行批准。
- 新漏洞：Todo 使用说明句，没有严格写成 `执行 /sdlc-review`，与完整推荐命令不一致。

## 第二次 GREEN 观察

- Session：`ses_025294d94ffewOv7pUamiBQlIQ`
- 模型：`gpt-5.6-luna`，`variant: max`
- 结果：缺少 RequirementBaseline 时立即停止，没有输出设计、CU、Plan 或批准结论，也没有修改文件。
- 推荐命令：`/sdlc-review`。
- Todo：`执行 /sdlc-review`，与完整命令一致。
