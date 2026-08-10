import { realpath } from "node:fs/promises";
import path from "node:path";

export class WorkspaceBoundaryError extends Error {}

export function toWorkspaceRelativePath(workspaceRoot: string, candidate: string): string {
  const root = path.resolve(workspaceRoot);
  const resolved = path.resolve(candidate);
  const relative = path.relative(root, resolved);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new WorkspaceBoundaryError(`Path escapes workspace: ${candidate}`);
  }
  return relative.replaceAll("\\", "/");
}

export async function resolveStoredSnapshotPath(workspaceRoot: string, candidate: string): Promise<string> {
  if (!path.isAbsolute(candidate)) return resolveWorkspacePath(workspaceRoot, candidate);

  const relative = path.relative(path.resolve(workspaceRoot), path.resolve(candidate));
  if (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
    return resolveWorkspacePath(workspaceRoot, candidate);
  }

  const segments = candidate.split(/[\\/]/u);
  const stateIndex = segments.lastIndexOf(".sdlc-factory");
  if (stateIndex < 0) throw new WorkspaceBoundaryError(`Stored snapshot is not project state: ${candidate}`);
  return resolveWorkspacePath(workspaceRoot, segments.slice(stateIndex).join(path.sep));
}

export async function resolveWorkspacePath(workspaceRoot: string, candidate: string): Promise<string> {
  const root = path.resolve(workspaceRoot);
  const resolved = path.resolve(root, candidate);
  const relative = path.relative(root, resolved);

  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new WorkspaceBoundaryError(`Path escapes workspace: ${candidate}`);
  }

  const realRoot = await realpath(root);
  const realAncestor = await nearestExistingRealPath(resolved);
  const realRelative = path.relative(realRoot, realAncestor);
  if (realRelative === ".." || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) {
    throw new WorkspaceBoundaryError(`Path escapes workspace through a symbolic link: ${candidate}`);
  }

  return resolved;
}

async function nearestExistingRealPath(candidate: string): Promise<string> {
  let current = candidate;
  while (true) {
    try {
      return await realpath(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      current = parent;
    }
  }
}
