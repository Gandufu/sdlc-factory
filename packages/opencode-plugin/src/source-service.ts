import { readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";

import { sha256 } from "./hash.js";
import type { ProjectStore } from "./project-store.js";
import { toWorkspaceRelativePath } from "./workspace-path.js";

export class SourceBoundaryError extends Error {}

export type SourceEntry = {
  path: string;
  snapshotPath: string;
  sha256: string;
  size: number;
};

export type SourceSnapshot = {
  sourceId: string;
  originalPath: string;
  sha256: string;
  kind?: "FILE" | "DIRECTORY";
  snapshotPath?: string;
  entries?: SourceEntry[];
};

const MAX_DIRECTORY_FILES = 2_000;
const MAX_DIRECTORY_BYTES = 200 * 1024 * 1024;

export class SourceService {
  constructor(
    private readonly store: ProjectStore,
    private readonly workspaceRoot: string,
    private readonly allowedReadRoots: string[],
  ) {}

  async snapshot(sourceId: string, sourcePath: string): Promise<SourceSnapshot> {
    if (!/^[a-z][a-z0-9-]{1,63}$/u.test(sourceId)) throw new Error(`Invalid source id: ${sourceId}`);
    const realSourcePath = await this.assertAllowedPath(sourcePath);
    const sourceStats = await stat(realSourcePath);
    if (sourceStats.isDirectory()) {
      const files = await readDirectoryFiles(realSourcePath);
      if (files.length > MAX_DIRECTORY_FILES) {
        throw new Error(`来源目录文件数超过上限 ${MAX_DIRECTORY_FILES}: ${sourcePath}`);
      }
      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
      if (totalBytes > MAX_DIRECTORY_BYTES) {
        throw new Error(`来源目录总大小超过上限 ${MAX_DIRECTORY_BYTES}: ${sourcePath}`);
      }
      const entries: SourceEntry[] = [];
      for (const file of files) {
        const bytes = await readFile(path.join(realSourcePath, ...file.path.split("/")));
        const contentHash = sha256(bytes);
        const absoluteSnapshotPath = await this.store.ensureImmutableBytes(
          path.join("source-snapshots", sourceId, "objects", "sha256", contentHash.slice(0, 2), contentHash),
          bytes,
        );
        entries.push({
          path: file.path,
          snapshotPath: toWorkspaceRelativePath(this.workspaceRoot, absoluteSnapshotPath),
          sha256: contentHash,
          size: bytes.byteLength,
        });
      }
      const aggregateHash = sha256(Buffer.from(JSON.stringify(entries.map(({ path: entryPath, sha256: entryHash, size }) => ({
        path: entryPath,
        sha256: entryHash,
        size,
      }))), "utf8"));
      const snapshot: SourceSnapshot = {
        sourceId,
        originalPath: realSourcePath,
        sha256: aggregateHash,
        kind: "DIRECTORY",
        entries,
      };
      await this.store.writeImmutable("sources", sourceId, snapshot);
      return snapshot;
    }
    if (!sourceStats.isFile()) throw new Error(`来源必须是普通文件或目录: ${sourcePath}`);
    const bytes = await readFile(realSourcePath);
    const absoluteSnapshotPath = await this.store.writeImmutableBytes(path.join("source-snapshots", sourceId, "original"), bytes);
    const snapshotPath = toWorkspaceRelativePath(this.workspaceRoot, absoluteSnapshotPath);
    const snapshot: SourceSnapshot = { sourceId, originalPath: realSourcePath, snapshotPath, sha256: sha256(bytes), kind: "FILE" };
    await this.store.writeImmutable("sources", sourceId, snapshot);
    return snapshot;
  }

  async list(rootIndex: number, relativePath: string, recursive: boolean, maxEntries: number): Promise<{
    rootIndex: number;
    rootPath: string;
    relativePath: string;
    entries: Array<{ path: string; type: "FILE" | "DIRECTORY"; size?: number }>;
    truncated: boolean;
  }> {
    const root = this.allowedReadRoots[rootIndex];
    if (!root) throw new Error(`授权资料目录序号不存在: ${rootIndex}`);
    const realRoot = await realpath(root);
    const requested = await this.assertWithinRoot(realRoot, path.resolve(realRoot, relativePath || "."));
    const entries: Array<{ path: string; type: "FILE" | "DIRECTORY"; size?: number }> = [];
    let truncated = false;
    const visit = async (directory: string) => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue;
        const absolute = path.join(directory, entry.name);
        const portable = path.relative(realRoot, absolute).replaceAll("\\", "/");
        if (entries.length >= maxEntries) {
          truncated = true;
          return;
        }
        if (entry.isDirectory()) {
          entries.push({ path: portable, type: "DIRECTORY" });
          if (recursive) await visit(absolute);
        } else if (entry.isFile()) {
          entries.push({ path: portable, type: "FILE", size: (await stat(absolute)).size });
        }
        if (truncated) return;
      }
    };
    const requestedStats = await stat(requested);
    if (requestedStats.isDirectory()) await visit(requested);
    else entries.push({ path: path.relative(realRoot, requested).replaceAll("\\", "/"), type: "FILE", size: requestedStats.size });
    return {
      rootIndex,
      rootPath: realRoot,
      relativePath: path.relative(realRoot, requested).replaceAll("\\", "/") || ".",
      entries: entries.sort((left, right) => left.path.localeCompare(right.path)),
      truncated,
    };
  }

  private async assertAllowedPath(sourcePath: string): Promise<string> {
    const realSourcePath = await realpath(sourcePath);
    const allowed = await Promise.all(this.allowedReadRoots.map((root) => realpath(root)));
    for (const root of allowed) {
      try {
        return await this.assertWithinRoot(root, realSourcePath);
      } catch (error) {
        if (!(error instanceof SourceBoundaryError)) throw error;
      }
    }
    throw new SourceBoundaryError(`Source is outside allowed read roots: ${sourcePath}`);
  }

  private async assertWithinRoot(realRoot: string, candidate: string): Promise<string> {
    const realCandidate = await realpath(candidate);
    const relative = path.relative(realRoot, realCandidate);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new SourceBoundaryError(`Source is outside allowed read root: ${candidate}`);
    }
    return realCandidate;
  }
}

async function readDirectoryFiles(root: string, relativeDirectory = ""): Promise<Array<{ path: string; size: number }>> {
  const directory = path.join(root, ...relativeDirectory.split("/").filter(Boolean));
  const files: Array<{ path: string; size: number }> = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new SourceBoundaryError(`来源目录不能包含符号链接: ${path.join(directory, entry.name)}`);
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) files.push(...await readDirectoryFiles(root, relativePath));
    if (entry.isFile()) files.push({ path: relativePath, size: (await stat(path.join(directory, entry.name))).size });
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
}
