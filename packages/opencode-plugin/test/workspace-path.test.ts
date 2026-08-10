import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { WorkspaceBoundaryError, resolveWorkspacePath } from "../src/workspace-path.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("resolveWorkspacePath", () => {
  it("rejects a path that escapes the workspace", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-workspace-"));
    temporaryDirectories.push(workspace);
    await expect(
      resolveWorkspacePath(workspace, path.join("..", "outside.txt")),
    ).rejects.toBeInstanceOf(WorkspaceBoundaryError);
  });

  it("rejects a workspace path that escapes through a directory link", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-workspace-"));
    const outside = await mkdtemp(path.join(tmpdir(), "sdlc-outside-"));
    temporaryDirectories.push(workspace, outside);
    await mkdir(path.join(workspace, "docs"), { recursive: true });
    await symlink(outside, path.join(workspace, "docs", "linked"), process.platform === "win32" ? "junction" : "dir");

    await expect(resolveWorkspacePath(workspace, "docs/linked/escaped.md"))
      .rejects.toThrow("symbolic link");
  });
});
