import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

import { sha256 } from "./hash.js";
import type { ProjectStore } from "./project-store.js";
import { toWorkspaceRelativePath } from "./workspace-path.js";

export class SourceBoundaryError extends Error {}

export class SourceService {
  constructor(
    private readonly store: ProjectStore,
    private readonly workspaceRoot: string,
    private readonly allowedReadRoots: string[],
  ) {}

  async snapshot(sourceId: string, sourcePath: string): Promise<{
    sourceId: string;
    originalPath: string;
    snapshotPath: string;
    sha256: string;
  }> {
    if (!/^[a-z][a-z0-9-]{1,63}$/u.test(sourceId)) throw new Error(`Invalid source id: ${sourceId}`);
    const realSourcePath = await realpath(sourcePath);
    const allowed = await Promise.all(this.allowedReadRoots.map((root) => realpath(root)));
    const isAllowed = allowed.some((root) => {
      const relative = path.relative(root, realSourcePath);
      return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
    });
    if (!isAllowed) {
      throw new SourceBoundaryError(`Source is outside allowed read roots: ${sourcePath}`);
    }
    const bytes = await readFile(realSourcePath);
    const absoluteSnapshotPath = await this.store.writeImmutableBytes(path.join("source-snapshots", sourceId, "original"), bytes);
    const snapshotPath = toWorkspaceRelativePath(this.workspaceRoot, absoluteSnapshotPath);
    const snapshot = { sourceId, originalPath: realSourcePath, snapshotPath, sha256: sha256(bytes) };
    await this.store.writeImmutable("sources", sourceId, snapshot);
    return snapshot;
  }
}
