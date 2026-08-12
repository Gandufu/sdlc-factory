import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { sha256 } from "../src/hash.js";
import { migrateLegacyRevisions } from "../src/state-migration.js";
import { resolveStoredSnapshotPath } from "../src/workspace-path.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("migrateLegacyRevisions", () => {
  it("无损迁移相对和旧机器绝对快照引用并保留迁移清单", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-migration-"));
    temporaryDirectories.push(workspace);
    const stateRoot = path.join(workspace, ".sdlc-factory");
    const revisionRoot = path.join(stateRoot, "revisions", "candidate-1");
    await mkdir(path.join(stateRoot, "candidates"), { recursive: true });
    await mkdir(path.join(stateRoot, "approved-versions"), { recursive: true });
    await mkdir(revisionRoot, { recursive: true });

    const bytes = Buffer.from("test snapshot\n", "utf8");
    const hash = sha256(bytes);
    const snapshot = path.join(revisionRoot, "0001-domain.test.ts");
    const orphanBytes = Buffer.from("orphan snapshot\n", "utf8");
    await writeFile(snapshot, bytes);
    await writeFile(path.join(revisionRoot, "0002-orphan.test.tsx"), orphanBytes);

    const subject = {
      path: "tests/domain.test.ts",
      sha256: hash,
      size: bytes.byteLength,
      snapshotPath: ".sdlc-factory/revisions/candidate-1/0001-domain.test.ts",
    };
    const candidate = { candidateId: "candidate-1", contentHash: "approved-hash", subjects: [subject] };
    const version = {
      versionId: "code-module-r1",
      candidateId: "candidate-1",
      candidateHash: "approved-hash",
      subjects: [{
        ...subject,
        snapshotPath: "D:\\old-workspace\\project\\.sdlc-factory\\revisions\\candidate-1\\0001-domain.test.ts",
      }],
    };
    await writeFile(
      path.join(stateRoot, "candidates", "candidate-1.json"),
      `${JSON.stringify(candidate, null, 2)}\n`,
    );
    await writeFile(
      path.join(stateRoot, "approved-versions", "code-module-r1.json"),
      `${JSON.stringify(version, null, 2)}\n`,
    );
    const candidateBytesBefore = await readFile(path.join(stateRoot, "candidates", "candidate-1.json"));
    const versionBytesBefore = await readFile(path.join(stateRoot, "approved-versions", "code-module-r1.json"));

    const result = await migrateLegacyRevisions(workspace);

    expect(result).toEqual({
      indexedLegacyReferences: 2,
      migratedLegacyFiles: 2,
      removedLegacyDirectory: true,
    });
    await expect(access(path.join(stateRoot, "revisions"))).rejects.toThrow();
    const objectPath = path.join(stateRoot, "objects", "sha256", hash.slice(0, 2), hash);
    await expect(readFile(objectPath)).resolves.toEqual(bytes);

    await expect(readFile(path.join(stateRoot, "candidates", "candidate-1.json")))
      .resolves.toEqual(candidateBytesBefore);
    await expect(readFile(path.join(stateRoot, "approved-versions", "code-module-r1.json")))
      .resolves.toEqual(versionBytesBefore);
    await expect(readFile(await resolveStoredSnapshotPath(workspace, subject.snapshotPath))).resolves.toEqual(bytes);
    await expect(readFile(await resolveStoredSnapshotPath(workspace, version.subjects[0]!.snapshotPath)))
      .resolves.toEqual(bytes);

    const manifest = JSON.parse(
      await readFile(path.join(stateRoot, "migrations", "revisions-to-objects-v1.json"), "utf8"),
    );
    expect(manifest.entries).toHaveLength(2);
    expect(manifest.entries.map((entry: { legacyPath: string }) => entry.legacyPath))
      .toContain(".sdlc-factory/revisions/candidate-1/0002-orphan.test.tsx");
    await expect(migrateLegacyRevisions(workspace)).resolves.toEqual({
      indexedLegacyReferences: 0,
      migratedLegacyFiles: 0,
      removedLegacyDirectory: false,
    });
  });

  it("快照字节与记录不一致时拒绝迁移且保留旧状态", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-migration-"));
    temporaryDirectories.push(workspace);
    const stateRoot = path.join(workspace, ".sdlc-factory");
    const revisionRoot = path.join(stateRoot, "revisions", "candidate-1");
    await mkdir(path.join(stateRoot, "candidates"), { recursive: true });
    await mkdir(revisionRoot, { recursive: true });
    await writeFile(path.join(revisionRoot, "0001.test.ts"), "actual\n");
    await writeFile(path.join(stateRoot, "candidates", "candidate-1.json"), `${JSON.stringify({
      candidateId: "candidate-1",
      contentHash: "unchanged",
      subjects: [{
        path: "tests/domain.test.ts",
        sha256: sha256(Buffer.from("expected\n")),
        size: Buffer.byteLength("expected\n"),
        snapshotPath: ".sdlc-factory/revisions/candidate-1/0001.test.ts",
      }],
    }, null, 2)}\n`);

    await expect(migrateLegacyRevisions(workspace)).rejects.toThrow("旧候选快照与记录哈希不一致");
    await expect(access(path.join(stateRoot, "revisions", "candidate-1", "0001.test.ts"))).resolves.toBeUndefined();
    await expect(access(path.join(stateRoot, "migrations", "revisions-to-objects-v1.json"))).rejects.toThrow();
    await expect(readFile(path.join(stateRoot, "candidates", "candidate-1.json"), "utf8"))
      .resolves.toContain('"contentHash": "unchanged"');
  });
});
