import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { Candidate } from "../src/domain.js";
import { sha256 } from "../src/hash.js";
import { ProjectStore } from "../src/project-store.js";
import { ReviewMismatchError, ReviewService, StaleCandidateError } from "../src/review-service.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function candidateFixture(workspace: string): Promise<{ store: ProjectStore; candidate: Candidate }> {
  const store = new ProjectStore(workspace);
  const bytes = Buffer.from("# 产品概述\n", "utf8");
  await writeFile(path.join(workspace, "brief.md"), bytes);
  const snapshotPath = await store.writeImmutableBytes("revisions/candidate-1/0001-brief.md", bytes);
  const candidate: Candidate = {
    candidateId: "candidate-1",
    kind: "PRODUCT_BRIEF",
    scope: { type: "PROJECT", id: "project", name: "项目" },
    revision: 1,
    contentHash: "a".repeat(64),
    subjectPaths: ["brief.md"],
    subjects: [{ path: "brief.md", sha256: sha256(bytes), size: bytes.byteLength, snapshotPath }],
    inputVersionIds: [],
    sourceIds: [],
    testRecordIds: [],
    changeType: "STRUCTURE",
    changeSummary: "建立产品概述",
    proposedImpactScopeIds: [],
    deterministicChecks: [{ check: "fixture", status: "PASSED", detail: "测试" }],
    createdBySessionId: "session-1",
    createdAt: "2026-08-11T05:00:00.000Z",
  };
  await store.writeImmutable("candidates", candidate.candidateId, candidate);
  return { store, candidate };
}

describe("ReviewService", () => {
  it("只接受当前会话用户原文中的候选编号和完整哈希", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-review-"));
    temporaryDirectories.push(workspace);
    const { store, candidate } = await candidateFixture(workspace);
    const service = new ReviewService(store, workspace, {
      latestUserText: async () => `通过 candidate-1 ${"b".repeat(64)}`,
    }, { id: () => "review-1", now: () => "2026-08-11T05:01:00.000Z" });

    await expect(service.apply("session-1", {
      candidateId: candidate.candidateId,
      candidateHash: candidate.contentHash,
      decision: "APPROVE",
    })).rejects.toBeInstanceOf(ReviewMismatchError);
  });

  it("批准前复核工作区和不可变快照并创建单调修订版本", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-review-"));
    temporaryDirectories.push(workspace);
    const { store, candidate } = await candidateFixture(workspace);
    const service = new ReviewService(store, workspace, {
      latestUserText: async () => `通过 ${candidate.candidateId} ${candidate.contentHash}`,
    }, { id: () => "review-1", now: () => "2026-08-11T05:01:00.000Z" });

    const result = await service.apply("session-1", {
      candidateId: candidate.candidateId,
      candidateHash: candidate.contentHash,
      decision: "APPROVE",
    });

    expect(result.versionId).toBe("product-brief-project-r1");
    await expect(readFile(
      path.join(workspace, ".sdlc-factory", "approved-versions", "product-brief-project-r1.json"),
      "utf8",
    )).resolves.toContain('"candidateHash":');
  });

  it("候选后文件变化时拒绝批准", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-review-"));
    temporaryDirectories.push(workspace);
    const { store, candidate } = await candidateFixture(workspace);
    await writeFile(path.join(workspace, "brief.md"), "changed\n", "utf8");
    const service = new ReviewService(store, workspace, {
      latestUserText: async () => `通过 ${candidate.candidateId} ${candidate.contentHash}`,
    }, { id: () => "review-1", now: () => "2026-08-11T05:01:00.000Z" });

    await expect(service.apply("session-1", {
      candidateId: candidate.candidateId,
      candidateHash: candidate.contentHash,
      decision: "APPROVE",
    })).rejects.toBeInstanceOf(StaleCandidateError);
  });
});
