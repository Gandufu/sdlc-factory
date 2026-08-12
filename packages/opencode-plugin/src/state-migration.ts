import { access, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ArtifactSubject } from "./domain.js";
import { sha256 } from "./hash.js";
import { ProjectStore } from "./project-store.js";
import { resolveStoredSnapshotPath, toWorkspaceRelativePath } from "./workspace-path.js";

type SnapshotRecord = Record<string, unknown> & { subjects?: ArtifactSubject[] };

type MigrationEntry = {
  legacyPath: string;
  objectPath: string;
  sha256: string;
  size: number;
};

export type StateMigrationResult = {
  indexedLegacyReferences: number;
  migratedLegacyFiles: number;
  removedLegacyDirectory: boolean;
};

export async function migrateLegacyRevisions(workspaceRoot: string): Promise<StateMigrationResult> {
  const stateRoot = path.join(workspaceRoot, ".sdlc-factory");
  const revisionsRoot = path.join(stateRoot, "revisions");
  if (!(await exists(revisionsRoot))) return emptyResult();

  const store = new ProjectStore(workspaceRoot);
  let indexedLegacyReferences = 0;

  for (const directory of ["candidates", "approved-versions"]) {
    const recordRoot = path.join(stateRoot, directory);
    if (!(await exists(recordRoot))) continue;
    for (const entry of await readdir(recordRoot, { withFileTypes: true })) {
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".json") continue;
      const filePath = path.join(recordRoot, entry.name);
      const value = JSON.parse(await readFile(filePath, "utf8")) as SnapshotRecord;
      if (!Array.isArray(value.subjects)) continue;

      for (const subject of value.subjects) {
        const legacyPath = await resolveLegacySnapshotPath(workspaceRoot, revisionsRoot, subject.snapshotPath);
        if (!legacyPath) {
          continue;
        }
        const bytes = await readFile(legacyPath);
        if (bytes.byteLength !== subject.size || sha256(bytes) !== subject.sha256) {
          throw new Error(`旧候选快照与记录哈希不一致: ${subject.snapshotPath}`);
        }
        indexedLegacyReferences += 1;
      }
    }
  }

  const legacyFiles = await listFiles(revisionsRoot);
  const migrationEntries: MigrationEntry[] = [];
  for (const legacyFile of legacyFiles) {
    const bytes = await readFile(legacyFile);
    const hash = sha256(bytes);
    const objectPath = objectReferencePath(hash);
    await store.ensureImmutableBytes(objectStorePath(hash), bytes);
    migrationEntries.push({
      legacyPath: toWorkspaceRelativePath(workspaceRoot, legacyFile),
      objectPath,
      sha256: hash,
      size: bytes.byteLength,
    });
  }

  const migrationManifest = {
    schemaVersion: 1,
    migration: "legacy-revisions-to-content-addressed-objects",
    entries: migrationEntries.sort((left, right) => left.legacyPath.localeCompare(right.legacyPath)),
  };
  await mkdir(path.join(stateRoot, "migrations"), { recursive: true });
  await replaceJson(
    path.join(stateRoot, "migrations", "revisions-to-objects-v1.json"),
    migrationManifest,
  );
  await rm(revisionsRoot, { recursive: true, force: false });

  return {
    indexedLegacyReferences,
    migratedLegacyFiles: legacyFiles.length,
    removedLegacyDirectory: true,
  };
}

async function resolveLegacySnapshotPath(
  workspaceRoot: string,
  revisionsRoot: string,
  snapshotPath: string,
): Promise<string | undefined> {
  const resolved = await resolveStoredSnapshotPath(workspaceRoot, snapshotPath);
  const relative = path.relative(revisionsRoot, resolved);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return undefined;
  }
  return resolved;
}

function objectReferencePath(hash: string): string {
  return path.posix.join(".sdlc-factory", "objects", "sha256", hash.slice(0, 2), hash);
}

function objectStorePath(hash: string): string {
  return path.posix.join("objects", "sha256", hash.slice(0, 2), hash);
}

async function listFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...await listFiles(candidate));
    else if (entry.isFile()) result.push(candidate);
  }
  return result;
}

async function replaceJson(target: string, value: unknown): Promise<void> {
  const temporary = `${target}.${process.pid}.migration.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function emptyResult(): StateMigrationResult {
  return { indexedLegacyReferences: 0, migratedLegacyFiles: 0, removedLegacyDirectory: false };
}
