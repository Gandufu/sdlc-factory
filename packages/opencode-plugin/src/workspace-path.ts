import path from "node:path";

export class WorkspaceBoundaryError extends Error {}

export async function resolveWorkspacePath(workspaceRoot: string, candidate: string): Promise<string> {
  const root = path.resolve(workspaceRoot);
  const resolved = path.resolve(root, candidate);
  const relative = path.relative(root, resolved);

  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new WorkspaceBoundaryError(`Path escapes workspace: ${candidate}`);
  }

  return resolved;
}
