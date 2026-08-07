import { access } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("OpenCode runtime resources", () => {
  it("ships the complete MVP0 slash command surface", async () => {
    const runtimeRoot = path.resolve(import.meta.dirname, "..", "runtime", "commands");
    const commands = ["init", "spec", "design", "code", "test", "review", "status"];

    await expect(Promise.all(
      commands.map((command) => access(path.join(runtimeRoot, `sdlc-${command}.md`))),
    )).resolves.toHaveLength(commands.length);
  });

  it("ships the overall design skill", async () => {
    const skill = path.resolve(
      import.meta.dirname,
      "..",
      "runtime",
      "skills",
      "sdlc-overall-design",
      "SKILL.md",
    );

    await expect(access(skill)).resolves.toBeUndefined();
  });

  it("ships the CU coding skill", async () => {
    const skill = path.resolve(
      import.meta.dirname,
      "..",
      "runtime",
      "skills",
      "sdlc-cu-coding",
      "SKILL.md",
    );

    await expect(access(skill)).resolves.toBeUndefined();
  });

  it("ships the CU testing skill", async () => {
    const skill = path.resolve(
      import.meta.dirname,
      "..",
      "runtime",
      "skills",
      "sdlc-cu-testing",
      "SKILL.md",
    );

    await expect(access(skill)).resolves.toBeUndefined();
  });
});
