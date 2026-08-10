import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  resolveStoredSnapshotPath,
  WorkspaceBoundaryError,
  resolveWorkspacePath,
  toWorkspaceRelativePath,
} from "../src/workspace-path.js";

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

  it("使用项目相对快照路径，并兼容项目移动前保存的旧绝对路径", async () => {
    const oldWorkspace = path.join(tmpdir(), "sdlc-old-workspace");
    const movedWorkspace = await mkdtemp(path.join(tmpdir(), "sdlc-moved-workspace-"));
    temporaryDirectories.push(movedWorkspace);
    const oldSnapshot = path.join(oldWorkspace, ".sdlc-factory", "revisions", "candidate-1", "brief.md");

    expect(toWorkspaceRelativePath(oldWorkspace, oldSnapshot))
      .toBe(".sdlc-factory/revisions/candidate-1/brief.md");
    await expect(resolveStoredSnapshotPath(movedWorkspace, oldSnapshot))
      .resolves.toBe(path.join(movedWorkspace, ".sdlc-factory", "revisions", "candidate-1", "brief.md"));
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
