import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { InstallationConflictError, installRuntime } from "../src/installer.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function fixtureRuntime(): Promise<string> {
  const runtime = await mkdtemp(path.join(tmpdir(), "sdlc-runtime-"));
  temporaryDirectories.push(runtime);
  await mkdir(path.join(runtime, "plugins"), { recursive: true });
  await writeFile(path.join(runtime, "plugins", "sdlc-factory.js"), "export const plugin = true;\n", "utf8");
  return runtime;
}

describe("installRuntime", () => {
  it("installs managed runtime files into the target project", async () => {
    const runtime = await fixtureRuntime();
    const target = await mkdtemp(path.join(tmpdir(), "sdlc-target-"));
    temporaryDirectories.push(target);

    await installRuntime(runtime, target, "0.1.0");

    await expect(readFile(path.join(target, ".opencode", "plugins", "sdlc-factory.js"), "utf8"))
      .resolves.toBe("export const plugin = true;\n");
  });

  it("refuses to overwrite an unmanaged plugin file", async () => {
    const runtime = await fixtureRuntime();
    const target = await mkdtemp(path.join(tmpdir(), "sdlc-target-"));
    temporaryDirectories.push(target);
    await mkdir(path.join(target, ".opencode", "plugins"), { recursive: true });
    await writeFile(path.join(target, ".opencode", "plugins", "sdlc-factory.js"), "unmanaged\n", "utf8");

    await expect(installRuntime(runtime, target, "0.1.0")).rejects.toBeInstanceOf(InstallationConflictError);
  });

  it("upgrades a managed install without retaining legacy skill directories", async () => {
    const runtime = await fixtureRuntime();
    const target = await mkdtemp(path.join(tmpdir(), "sdlc-target-"));
    temporaryDirectories.push(target);
    const configRoot = path.join(target, ".opencode");
    await mkdir(path.join(configRoot, "skills", "sdlc-requirement-analysis"), { recursive: true });
    await writeFile(path.join(configRoot, "skills", "sdlc-requirement-analysis", "SKILL.md"), "legacy\n", "utf8");
    await writeFile(path.join(configRoot, "sdlc-factory-install.json"), "{}\n", "utf8");

    await installRuntime(runtime, target, "0.1.0");

    await expect(readFile(path.join(configRoot, "skills", "sdlc-requirement-analysis", "SKILL.md"), "utf8"))
      .rejects.toThrow();
  });
});
