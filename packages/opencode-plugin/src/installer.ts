import { access, copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { sha256 } from "./hash.js";
import { migrateLegacyRevisions, type StateMigrationResult } from "./state-migration.js";

export class InstallationConflictError extends Error {}

type ManagedFile = { path: string; sha256: string };
type InstallationManifest = { version?: string; files?: ManagedFile[] };

export async function installRuntime(
  runtimeRoot: string,
  targetRoot: string,
  version: string,
): Promise<StateMigrationResult> {
  const configRoot = path.join(targetRoot, ".opencode");
  const manifestTarget = path.join(configRoot, "sdlc-factory-install.json");
  await mkdir(configRoot, { recursive: true });
  const runtimeFiles = await listRuntimeFiles(runtimeRoot);
  const previousManifest = await readManifest(manifestTarget);
  const previousFiles = new Map((previousManifest?.files ?? []).map((file) => [file.path, file]));
  const legacyManagedInstall = Boolean(previousManifest && !previousManifest.files);
  for (const file of runtimeFiles) {
    const target = path.join(configRoot, ...file.path.split("/"));
    if (!(await exists(target))) continue;
    const previous = previousFiles.get(file.path);
    if (!previous && !legacyManagedInstall) {
      throw new InstallationConflictError(`Refusing to overwrite unmanaged file: ${target}`);
    }
    if (previous && await fileHash(target) !== previous.sha256) {
      throw new InstallationConflictError(`Refusing to overwrite modified managed file: ${target}`);
    }
  }
  const migration = await migrateLegacyRevisions(targetRoot);
  if (await exists(manifestTarget)) {
    for (const legacyDirectory of [
      "sdlc-requirement-analysis",
      "sdlc-overall-design",
      "sdlc-cu-coding",
      "sdlc-cu-testing",
    ]) {
      await rm(path.join(configRoot, "skills", legacyDirectory), { recursive: true, force: true });
    }
  }
  const currentPaths = new Set(runtimeFiles.map((file) => file.path));
  for (const previous of previousFiles.values()) {
    if (currentPaths.has(previous.path)) continue;
    const target = path.join(configRoot, ...previous.path.split("/"));
    if (!(await exists(target))) continue;
    if (await fileHash(target) !== previous.sha256) {
      throw new InstallationConflictError(`Refusing to remove modified managed file: ${target}`);
    }
    await rm(target);
  }
  for (const file of runtimeFiles) {
    const target = path.join(configRoot, ...file.path.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(runtimeRoot, ...file.path.split("/")), target);
  }
  await writeFile(
    manifestTarget,
    `${JSON.stringify({ version, files: runtimeFiles }, null, 2)}\n`,
    "utf8",
  );
  return migration;
}

async function readManifest(target: string): Promise<InstallationManifest | undefined> {
  if (!(await exists(target))) return undefined;
  try {
    return JSON.parse(await readFile(target, "utf8")) as InstallationManifest;
  } catch {
    throw new InstallationConflictError(`Refusing to use invalid installation manifest: ${target}`);
  }
}

async function listRuntimeFiles(runtimeRoot: string, relativeDirectory = ""): Promise<ManagedFile[]> {
  const directory = path.join(runtimeRoot, ...relativeDirectory.split("/").filter(Boolean));
  const entries = await readdir(directory, { withFileTypes: true });
  const files: ManagedFile[] = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) files.push(...await listRuntimeFiles(runtimeRoot, relativePath));
    if (entry.isFile()) files.push({ path: relativePath, sha256: await fileHash(path.join(directory, entry.name)) });
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function fileHash(target: string): Promise<string> {
  return sha256(await readFile(target));
}

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}
