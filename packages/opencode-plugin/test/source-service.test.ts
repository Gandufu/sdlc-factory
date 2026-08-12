import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ProjectStore } from "../src/project-store.js";
import { SourceBoundaryError, SourceService } from "../src/source-service.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("SourceService", () => {
  it("rejects a source outside explicitly allowed read roots", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-source-workspace-"));
    const allowed = await mkdtemp(path.join(tmpdir(), "sdlc-source-allowed-"));
    const outside = await mkdtemp(path.join(tmpdir(), "sdlc-source-outside-"));
    temporaryDirectories.push(workspace, allowed, outside);
    const outsideFile = path.join(outside, "requirements.md");
    await writeFile(outsideFile, "secret", "utf8");
    const service = new SourceService(new ProjectStore(workspace), workspace, [allowed]);

    await expect(service.snapshot("source-1", outsideFile)).rejects.toBeInstanceOf(SourceBoundaryError);
  });

  it("copies exact bytes into the project state without modifying the source", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-source-workspace-"));
    const allowed = await mkdtemp(path.join(tmpdir(), "sdlc-source-allowed-"));
    temporaryDirectories.push(workspace, allowed);
    const sourceFile = path.join(allowed, "requirements.md");
    await writeFile(sourceFile, Buffer.from([0x61, 0x0d, 0x0a]));
    const service = new SourceService(new ProjectStore(workspace), workspace, [allowed]);

    const snapshot = await service.snapshot("source-1", sourceFile);

    expect(snapshot.sha256).toBe("8e4621379786ef42a4fec155cd525c291dd7db3c1fde3478522f4f61c03fd1bd");
    expect(path.isAbsolute(snapshot.snapshotPath!)).toBe(false);
    await expect(readFile(path.join(workspace, snapshot.snapshotPath!))).resolves.toEqual(Buffer.from([0x61, 0x0d, 0x0a]));
    await expect(readFile(sourceFile)).resolves.toEqual(Buffer.from([0x61, 0x0d, 0x0a]));
  });

  it("lists and snapshots an authorized asset directory as one source fact", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-source-workspace-"));
    const allowed = await mkdtemp(path.join(tmpdir(), "sdlc-source-allowed-"));
    temporaryDirectories.push(workspace, allowed);
    await mkdir(path.join(allowed, "prototype", "assets"), { recursive: true });
    await writeFile(path.join(allowed, "prototype", "index.html"), "<main>原型</main>\n", "utf8");
    await writeFile(path.join(allowed, "prototype", "assets", "icon.png"), Buffer.from([0x00, 0x01, 0x02]));
    const service = new SourceService(new ProjectStore(workspace), workspace, [allowed]);

    const listing = await service.list(0, "prototype", true, 20);
    const snapshot = await service.snapshot("source-prototype", path.join(allowed, "prototype"));

    expect(listing.entries.map((entry) => entry.path)).toEqual([
      "prototype/assets",
      "prototype/assets/icon.png",
      "prototype/index.html",
    ]);
    expect(snapshot).toMatchObject({ kind: "DIRECTORY", sourceId: "source-prototype" });
    expect(snapshot.entries?.map((entry) => entry.path)).toEqual(["assets/icon.png", "index.html"]);
    expect(snapshot.entries?.every((entry) => !path.isAbsolute(entry.snapshotPath))).toBe(true);
  });
});
