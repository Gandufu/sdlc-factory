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
});
