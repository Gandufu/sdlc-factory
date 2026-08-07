import { describe, expect, it } from "vitest";

import { WorkspaceBoundaryError, resolveWorkspacePath } from "../src/workspace-path.js";

describe("resolveWorkspacePath", () => {
  it("rejects a path that escapes the workspace", async () => {
    await expect(
      resolveWorkspacePath("D:\\workspace\\project", "..\\outside.txt"),
    ).rejects.toBeInstanceOf(WorkspaceBoundaryError);
  });
});
