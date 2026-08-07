import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("built installer CLI", () => {
  it("starts as valid JavaScript and reports usage when arguments are missing", () => {
    const packageRoot = path.resolve(import.meta.dirname, "..");
    const build = spawnSync(process.execPath, [path.join(packageRoot, "scripts", "build.mjs")], {
      cwd: packageRoot,
      encoding: "utf8",
    });
    expect(build.status, build.stderr).toBe(0);

    const cli = spawnSync(process.execPath, [path.join(packageRoot, "dist", "cli.js")], {
      cwd: packageRoot,
      encoding: "utf8",
    });

    expect(cli.status).toBe(2);
    expect(cli.stderr).toContain("Usage: sdlc-factory-plugin install");
    expect(cli.stderr).not.toContain("SyntaxError");
  });
});
