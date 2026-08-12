import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { isWithinApprovedPath } from "./candidate-service.js";
import type { ApprovedVersion } from "./domain.js";
import { sha256 } from "./hash.js";
import type { ProjectStore } from "./project-store.js";
import { resolveWorkspacePath } from "./workspace-path.js";

export class ApprovedCodeDriftError extends Error {}

const TOOLCHAIN_PATHS = [
  "package.json",
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "tsconfig.base.json",
  "tsconfig.node.json",
  "forge.config.ts",
  "forge.config.js",
  "vite.config.ts",
  "vite.config.js",
  "vite.main.config.ts",
  "vite.preload.config.ts",
  "vite.renderer.config.ts",
  "vitest.config.ts",
  "vitest.config.js",
  "playwright.config.ts",
  "playwright.config.js",
  "eslint.config.mjs",
  "eslint.config.js",
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

  const codeVersions = inputVersionIds
    .map((versionId) => byId.get(versionId)!)
    .filter((version) => version.kind === "CODE");
  const paths: string[] = [];
  for (const version of codeVersions) {
    for (const subject of effectiveSubjects(version, codeVersions)) {
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
  codeVersions: ApprovedVersion[] = [version],
): Promise<boolean> {
  for (const subject of effectiveSubjects(version, codeVersions)) {
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

export async function currentApprovedCodeVersionIds(
  workspaceRoot: string,
  codeVersions: ApprovedVersion[],
): Promise<Set<string>> {
  const results = await Promise.all(codeVersions.map(async (version) => ({
    versionId: version.versionId,
    current: await approvedVersionBytesCurrent(workspaceRoot, version, codeVersions),
  })));
  return new Set(results.filter((item) => item.current).map((item) => item.versionId));
}

export function codeVersionDependsOn(
  version: ApprovedVersion,
  upstreamVersionId: string,
  codeVersions: ApprovedVersion[],
): boolean {
  const byId = new Map(codeVersions.map((candidate) => [candidate.versionId, candidate]));
  const pending = [...version.inputVersionIds];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const versionId = pending.pop()!;
    if (versionId === upstreamVersionId) return true;
    if (visited.has(versionId)) continue;
    visited.add(versionId);
    const dependency = byId.get(versionId);
    if (dependency?.kind === "CODE") pending.push(...dependency.inputVersionIds);
  }
  return false;
}

function effectiveSubjects(version: ApprovedVersion, codeVersions: ApprovedVersion[]) {
  return version.subjects.flatMap((subject) => {
    const overrides = codeVersions.filter((candidate) => candidate.versionId !== version.versionId
      && codeVersionDependsOn(candidate, version.versionId, codeVersions)
      && candidate.subjects.some((item) => item.path === subject.path));
    if (overrides.length === 0) return [subject];
    const leaves = overrides.filter((candidate) => !overrides.some((possibleChild) =>
      possibleChild.versionId !== candidate.versionId
      && codeVersionDependsOn(possibleChild, candidate.versionId, codeVersions)
      && possibleChild.subjects.some((item) => item.path === subject.path)));
    return leaves.flatMap((candidate) => candidate.subjects.filter((item) => item.path === subject.path));
  });
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

export async function existingFilesWithinApprovedPaths(
  workspaceRoot: string,
  allowedPatterns: string[],
): Promise<string[]> {
  const files = new Set<string>();
  for (const rawPattern of [...new Set(allowedPatterns)]) {
    const pattern = rawPattern.replaceAll("\\", "/");
    const wildcardIndex = pattern.search(/[?*]/u);
    const prefix = wildcardIndex < 0 ? pattern : pattern.slice(0, wildcardIndex);
    const scanRoot = wildcardIndex < 0
      ? pattern
      : prefix.endsWith("/") ? prefix.slice(0, -1) : path.posix.dirname(prefix);
    if (!scanRoot || scanRoot === ".") continue;
    let rootStats;
    try {
      rootStats = await stat(await resolveWorkspacePath(workspaceRoot, scanRoot));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    if (rootStats.isFile()) {
      if (isWithinApprovedPath(scanRoot, pattern)) files.add(scanRoot);
      continue;
    }
    if (!rootStats.isDirectory()) continue;
    for (const candidate of await listWorkspaceFiles(workspaceRoot, scanRoot)) {
      if (isWithinApprovedPath(candidate, pattern)) files.add(candidate);
    }
  }
  return [...files].sort();
}

async function listWorkspaceFiles(workspaceRoot: string, relativeDirectory: string): Promise<string[]> {
  const entries = await readdir(await resolveWorkspacePath(workspaceRoot, relativeDirectory), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const candidate = path.posix.join(relativeDirectory.replaceAll("\\", "/"), entry.name);
    if (entry.isFile()) files.push(candidate);
    if (entry.isDirectory()) files.push(...await listWorkspaceFiles(workspaceRoot, candidate));
  }
  return files;
}
