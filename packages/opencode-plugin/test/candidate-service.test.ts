import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { CandidateService } from "../src/candidate-service.js";
import { ProjectStore } from "../src/project-store.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("CandidateService", () => {
  it("binds a document candidate to the exact file bytes", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-candidate-"));
    temporaryDirectories.push(workspace);
    await mkdir(path.join(workspace, "docs"));
    await writeFile(path.join(workspace, "docs", "requirements.md"), Buffer.from([0x61, 0x0d, 0x0a]));
    const service = new CandidateService(new ProjectStore(workspace), workspace, {
      id: () => "candidate-1",
      now: () => "2026-08-07T05:00:00.000Z",
    });

    const candidate = await service.createDocumentCandidate("REQUIREMENT", ["docs/requirements.md"]);

    expect(candidate.contentHash).toBe("8e4621379786ef42a4fec155cd525c291dd7db3c1fde3478522f4f61c03fd1bd");
    const stored = JSON.parse(
      await readFile(
        path.join(workspace, ".sdlc-factory", "candidates", "candidate-1.json"),
        "utf8",
      ),
    ) as { contentHash: string };
    expect(stored.contentHash).toBe(candidate.contentHash);
  });
});
