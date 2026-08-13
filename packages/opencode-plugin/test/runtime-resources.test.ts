import { access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("OpenCode 运行资源", () => {
  it("包含完整公开命令", async () => {
    const root = path.resolve(import.meta.dirname, "..", "runtime", "commands");
    const commands = ["init", "spec", "design", "code", "test", "review", "status"];
    await expect(Promise.all(commands.map((name) => access(path.join(root, `sdlc-${name}.md`)))))
      .resolves.toHaveLength(commands.length);
  });

  it("初始化命令只推荐真实存在的需求命令", async () => {
    const command = await import("node:fs/promises").then(({ readFile }) => readFile(
      path.resolve(import.meta.dirname, "..", "runtime", "commands", "sdlc-init.md"),
      "utf8",
    ));
    expect(command).toContain("`/sdlc-spec`");
    expect(command).not.toContain("/sdlc-requirements");
  });

  it("按业务模块提供需求、设计、编码、模块测试和系统测试 Skills", async () => {
    const root = path.resolve(import.meta.dirname, "..", "runtime", "skills");
    const skills = [
      "sdlc-modular-requirements",
      "sdlc-modular-design",
      "sdlc-module-coding",
      "sdlc-module-testing",
      "sdlc-system-testing",
    ];
    await expect(Promise.all(skills.map((name) => access(path.join(root, name, "SKILL.md")))))
      .resolves.toHaveLength(skills.length);
  });

  it("编码技能用具体文件创建候选并正确处理首个修订", async () => {
    const skill = await import("node:fs/promises").then(({ readFile }) => readFile(
      path.resolve(import.meta.dirname, "..", "runtime", "skills", "sdlc-module-coding", "SKILL.md"),
      "utf8",
    ));
    expect(skill).toContain("逐项列出本次实际修改或新增的具体文件");
    expect(skill).toContain("不得把设计中的");
    expect(skill).toContain("首个代码修订不得传");
    expect(skill).toContain("每个受控命令的最后一次尝试都必须成功");
    expect(skill).toContain("不要求恢复基线、重开运行或重放改动");
  });

  it("模块测试技能只使用具体指纹并避免虚构环境和命令参数", async () => {
    const skill = await import("node:fs/promises").then(({ readFile }) => readFile(
      path.resolve(import.meta.dirname, "..", "runtime", "skills", "sdlc-module-testing", "SKILL.md"),
      "utf8",
    ));
    expect(skill).toContain("当前存在的具体文件");
    expect(skill).toContain("不得传 `src/**`");
    expect(skill).toContain("不得猜测 Jest、Vitest 等框架参数");
    expect(skill).toContain("纯本地、确定性的模块测试不登记虚构环境");
    expect(skill).toContain("模块测试不需要编码待办");
    expect(skill).toContain("不用通用 shell、递归 glob 或全文搜索枚举项目");
    expect(skill).toContain("sdlc_test_execute_existing");
    expect(skill).toContain("sdlc-test-run.mjs module");
    expect(skill).toContain("最多执行两次");
  });

  it("系统测试复用当前模块记录并区分模拟与真实验收", async () => {
    const skill = await import("node:fs/promises").then(({ readFile }) => readFile(
      path.resolve(import.meta.dirname, "..", "runtime", "skills", "sdlc-system-testing", "SKILL.md"),
      "utf8",
    ));
    expect(skill).toContain("不再调用");
    expect(skill).toContain("`sdlc_test_reuse_find`");
    expect(skill).toContain("`system 模拟`");
    expect(skill).toContain("不得宣称真实设备");
    expect(skill).toContain("不以目录或文件后缀猜测");
    expect(skill).toContain("不得额外要求 `tests/functional/*.functional.ts`");
    expect(skill).toContain("已有当前模拟环境版本时直接复用");
    expect(skill).toContain("`systemTestProfile=REAL`");
    expect(skill).toContain("不能形成正式系统验收");
    expect(skill).toContain("先执行项目已有的编译或打包命令");
    expect(skill).toContain("`command` 必须精确传");
    expect(skill).toContain("/sdlc-test system");
    expect(skill).toContain("不传工具返回的");
    expect(skill).toContain("`evidence/...`");
    expect(skill).toContain("sdlc_test_execute_existing");
    expect(skill).toContain("sdlc-test-run.mjs system");
    expect(skill).toContain("首错即停");
  });

  it("审核命令必须展示测试证据和模拟环境边界", async () => {
    const command = await import("node:fs/promises").then(({ readFile }) => readFile(
      path.resolve(import.meta.dirname, "..", "runtime", "commands", "sdlc-review.md"),
      "utf8",
    ));
    expect(command).toContain("`testRecords`");
    expect(command).toContain("通过/失败/跳过/阻塞命令数");
    expect(command).toContain("不代表真实设备验收");
    expect(command).toContain("不得推断真实设备");
    expect(command).toContain("结构化事实");
    expect(command).toContain("需求地图必须逐项展示业务模块");
  });

  it("编码技能允许已完成模块形成继承父版本的完整代码修订", async () => {
    const skill = await import("node:fs/promises").then(({ readFile }) => readFile(
      path.resolve(import.meta.dirname, "..", "runtime", "skills", "sdlc-module-coding", "SKILL.md"),
      "utf8",
    ));
    expect(skill).toContain("已完成模块的编码命令");
    expect(skill).toContain("合并为完整模块快照");
  });

  it("需求技能在候选事实充分后停止翻阅大资料", async () => {
    const skill = await import("node:fs/promises").then(({ readFile }) => readFile(
      path.resolve(import.meta.dirname, "..", "runtime", "skills", "sdlc-modular-requirements", "SKILL.md"),
      "utf8",
    ));
    expect(skill).toContain("当前候选仍缺必要事实");
    expect(skill).toContain("已经取得本候选所需事实后立即停止");
    expect(skill).toContain("scopeId=project");
  });

  it("需求技能按状态生成总需求版本且不重写普通需求", async () => {
    const skill = await import("node:fs/promises").then(({ readFile }) => readFile(
      path.resolve(import.meta.dirname, "..", "runtime", "skills", "sdlc-modular-requirements", "SKILL.md"),
      "utf8",
    ));
    expect(skill).toContain("sdlc_status.recommendedAction");
    expect(skill).toContain("sdlc_set_candidate_create(kind=REQUIREMENT_SET)");
    expect(skill).toContain("不得重新修订产品概述或需求地图");
    expect(skill).toContain("首个修订不得传");
    expect(skill).toContain("需求地图版本属于输入版本");
  });

  it("设计技能按状态生成总设计版本且不重写普通设计", async () => {
    const skill = await import("node:fs/promises").then(({ readFile }) => readFile(
      path.resolve(import.meta.dirname, "..", "runtime", "skills", "sdlc-modular-design", "SKILL.md"),
      "utf8",
    ));
    expect(skill).toContain("sdlc_status.recommendedAction");
    expect(skill).toContain("sdlc_set_candidate_create(kind=DESIGN_SET)");
    expect(skill).toContain("不得写设计文档");
    expect(skill).toContain("需求版本属于设计输入");
    expect(skill).toContain('禁止对项目根');
    expect(skill).toContain('glob("*")');
    expect(skill).toContain("枚举整个工作区");
    expect(skill).toContain("docs/verification/modules/<模块路径名>/verification-spec.md");
    expect(skill).toContain("不得把 `verification-spec.md` 放到 `docs/design` 下");
  });

  it("不再分发旧能力单元 Skills", async () => {
    const root = path.resolve(import.meta.dirname, "..", "runtime", "skills");
    for (const name of ["sdlc-overall-design", "sdlc-cu-coding", "sdlc-cu-testing"]) {
      await expect(access(path.join(root, name, "SKILL.md"))).rejects.toThrow();
    }
  });

  it("提供不经过模型的只读状态入口", () => {
    const root = path.resolve(import.meta.dirname, "..", "runtime");
    const result = spawnSync(process.execPath, [path.join(root, "bin", "sdlc-status.mjs"), "--target", root], {
      encoding: "utf8",
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      initialized: false,
      recommendedAction: { command: "/sdlc-init" },
    });
  });

  it("提供不经过模型的已有测试确定性重跑入口", () => {
    const root = path.resolve(import.meta.dirname, "..", "runtime");
    const result = spawnSync(process.execPath, [path.join(root, "bin", "sdlc-test-run.mjs")], {
      encoding: "utf8",
    });

    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("sdlc-test-run.mjs system");
    expect(result.stderr).toContain("不调用模型");
  });
});
