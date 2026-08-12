import { access, readFile, realpath } from "node:fs/promises";
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
  const relocated = relocateStoredPath(workspaceRoot, candidate);
  const resolved = await resolveWorkspacePath(workspaceRoot, relocated);
  if (await exists(resolved)) return resolved;

  const relative = toWorkspaceRelativePath(workspaceRoot, resolved);
  if (!relative.startsWith(".sdlc-factory/revisions/")) return resolved;
  const manifestPath = path.join(workspaceRoot, ".sdlc-factory", "migrations", "revisions-to-objects-v1.json");
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      entries?: Array<{ legacyPath: string; objectPath: string }>;
    };
    const migrated = manifest.entries?.find((entry) => normalizePortable(entry.legacyPath) === relative);
    if (!migrated || !normalizePortable(migrated.objectPath).startsWith(".sdlc-factory/objects/sha256/")) {
      return resolved;
    }
    return resolveWorkspacePath(workspaceRoot, migrated.objectPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return resolved;
    throw error;
  }
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

function relocateStoredPath(workspaceRoot: string, candidate: string): string {
  if (!path.isAbsolute(candidate)) return candidate;
  const relative = path.relative(path.resolve(workspaceRoot), path.resolve(candidate));
  if (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) return candidate;

  const segments = candidate.split(/[\\/]/u);
  const stateIndex = segments.lastIndexOf(".sdlc-factory");
  if (stateIndex < 0) throw new WorkspaceBoundaryError(`Stored snapshot is not project state: ${candidate}`);
  return segments.slice(stateIndex).join(path.sep);
}

function normalizePortable(candidate: string): string {
  return path.normalize(candidate).replaceAll("\\", "/");
}

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}
