import { copyFile, mkdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";

import { sha256 } from "./hash.js";
import type { ProjectStore } from "./project-store.js";

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
    const realSourcePath = await realpath(sourcePath);
    const allowed = await Promise.all(this.allowedReadRoots.map((root) => realpath(root)));
    const isAllowed = allowed.some((root) => {
      const relative = path.relative(root, realSourcePath);
      return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
    });
    if (!isAllowed) {
      throw new SourceBoundaryError(`Source is outside allowed read roots: ${sourcePath}`);
    }
    const directory = path.join(this.store.stateRoot, "source-snapshots", sourceId);
    const snapshotPath = path.join(directory, "original");
    const bytes = await readFile(realSourcePath);
    await mkdir(directory, { recursive: true });
    await copyFile(realSourcePath, snapshotPath);
    const snapshot = { sourceId, originalPath: realSourcePath, snapshotPath, sha256: sha256(bytes) };
    await this.store.writeImmutable("sources", sourceId, snapshot);
    return snapshot;
  }
}
