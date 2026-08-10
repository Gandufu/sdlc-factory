import { readFile, stat } from "node:fs/promises";

import type { ApprovedVersion } from "./domain.js";
import { sha256 } from "./hash.js";
import type { ProjectStore } from "./project-store.js";
import { resolveWorkspacePath } from "./workspace-path.js";

export class ApprovedCodeDriftError extends Error {}

const TOOLCHAIN_PATHS = [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.json",
] as const;

export async function assertApprovedCodeIntegrity(
  store: ProjectStore,
  workspaceRoot: string,
  inputVersionIds: string[],
): Promise<string[]> {
  const versions = await store.listJson<ApprovedVersion>("approved-versions");
  const byId = new Map(versions.map((version) => [version.versionId, version]));
  for (const versionId of inputVersionIds) {
    if (!byId.has(versionId)) throw new Error(`输入版本不存在或未批准: ${versionId}`);
  }

  const paths: string[] = [];
  for (const versionId of inputVersionIds) {
    const version = byId.get(versionId)!;
    if (version.kind !== "CODE") continue;
    for (const subject of version.subjects) {
      const bytes = await readFile(await resolveWorkspacePath(workspaceRoot, subject.path));
      if (bytes.byteLength !== subject.size || sha256(bytes) !== subject.sha256) {
        throw new ApprovedCodeDriftError(`已批准代码与工作区字节不一致: ${version.versionId}/${subject.path}`);
      }
      paths.push(subject.path);
    }
  }
  return [...new Set(paths)].sort();
}

export async function approvedVersionBytesCurrent(
  workspaceRoot: string,
  version: ApprovedVersion,
): Promise<boolean> {
  for (const subject of version.subjects) {
    try {
      const bytes = await readFile(await resolveWorkspacePath(workspaceRoot, subject.path));
      if (bytes.byteLength !== subject.size || sha256(bytes) !== subject.sha256) return false;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }
  return true;
}

export async function mandatoryFingerprintPaths(
  store: ProjectStore,
  workspaceRoot: string,
  inputVersionIds: string[],
  supplementalPaths: string[],
): Promise<string[]> {
  const paths = [
    ...await assertApprovedCodeIntegrity(store, workspaceRoot, inputVersionIds),
    ...supplementalPaths,
  ];
  for (const candidate of TOOLCHAIN_PATHS) {
    try {
      if ((await stat(await resolveWorkspacePath(workspaceRoot, candidate))).isFile()) paths.push(candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return [...new Set(paths.map((candidate) => candidate.replaceAll("\\", "/")))].sort();
}
