import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ProjectStore } from "../src/project-store.js";
import { ReviewMismatchError, ReviewService } from "../src/review-service.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("ReviewService", () => {
  it("uses the actual session message instead of model-supplied approval fields", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-review-"));
    temporaryDirectories.push(workspace);
    const store = new ProjectStore(workspace);
    const hash = "a".repeat(64);
    await store.writeImmutable("candidates", "candidate-1", {
      candidateId: "candidate-1",
      kind: "REQUIREMENT",
      contentHash: hash,
    });
    const service = new ReviewService(store, {
      latestUserText: async () => `通过 candidate-1 ${"b".repeat(64)}`,
    }, { id: () => "review-1", now: () => "2026-08-07T05:00:00.000Z" });

    await expect(
      service.apply("session-1", { candidateId: "candidate-1", candidateHash: hash, decision: "APPROVE" }),
    ).rejects.toBeInstanceOf(ReviewMismatchError);
  });

  it("creates immutable review and baseline records after a matching approval", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-review-"));
    temporaryDirectories.push(workspace);
    const store = new ProjectStore(workspace);
    const hash = "a".repeat(64);
    await store.writeImmutable("candidates", "candidate-1", {
      candidateId: "candidate-1",
      kind: "REQUIREMENT",
      contentHash: hash,
    });
    const service = new ReviewService(store, {
      latestUserText: async () => `通过 candidate-1 ${hash}`,
    }, { id: () => "review-1", now: () => "2026-08-07T05:00:00.000Z" });

    const result = await service.apply("session-1", {
      candidateId: "candidate-1",
      candidateHash: hash,
      decision: "APPROVE",
    });

    expect(result.baselineId).toBe("requirement-candidate-1");
    await expect(
      readFile(path.join(workspace, ".sdlc-factory", "reviews", "review-1.json"), "utf8"),
    ).resolves.toContain('"sessionId": "session-1"');
    await expect(
      readFile(
        path.join(workspace, ".sdlc-factory", "baselines", "requirement-candidate-1.json"),
        "utf8",
      ),
    ).resolves.toContain('"candidateHash":');
  });
});
