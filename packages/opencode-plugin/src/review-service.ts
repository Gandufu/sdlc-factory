import { readFile } from "node:fs/promises";

import { currentVersion } from "./candidate-service.js";
import { assertRealAcceptanceRecords } from "./environment-service.js";
import type { ApprovedVersion, Candidate, ReviewRecord } from "./domain.js";
import { sha256 } from "./hash.js";
import type { ProjectStore } from "./project-store.js";
import { parseReviewDecision } from "./review-decision.js";
import { resolveStoredSnapshotPath, resolveWorkspacePath } from "./workspace-path.js";

export class ReviewMismatchError extends Error {}
export class StaleCandidateError extends Error {}

type ReviewRequest = {
  candidateId: string;
  candidateHash: string;
  decision: "APPROVE" | "REVISE" | "HOLD";
};

type SessionMessages = { latestUserText(sessionId: string): Promise<string> };
type RuntimeValues = { id(): string; now(): string };

export class ReviewService {
  constructor(
    private readonly store: ProjectStore,
    private readonly workspaceRoot: string,
    private readonly sessionMessages: SessionMessages,
    private readonly runtime: RuntimeValues,
  ) {}

  async apply(sessionId: string, request: ReviewRequest): Promise<{ reviewId: string; versionId?: string }> {
    const candidate = await this.store.readJson<Candidate>("candidates", request.candidateId);
    const actual = parseReviewDecision(await this.sessionMessages.latestUserText(sessionId));
    if (
      actual.candidateId !== request.candidateId
      || actual.candidateHash !== request.candidateHash
      || actual.decision !== request.decision
      || candidate.contentHash !== request.candidateHash
    ) {
      throw new ReviewMismatchError("审核请求与当前会话用户原文或候选哈希不一致");
    }

    const reviews = await this.store.listJson<ReviewRecord>("reviews");
    const terminal = reviews.find((review) => review.candidateId === request.candidateId
      && (review.decision === "APPROVE" || review.decision === "REVISE"));
    if (terminal) throw new ReviewMismatchError(`候选已经完成终局审核: ${terminal.reviewId}`);

    if (request.decision === "APPROVE") {
      await this.verifyCandidateBytes(candidate);
      if (candidate.kind === "SYSTEM_ACCEPTANCE") {
        await assertRealAcceptanceRecords(this.store, candidate.testRecordIds);
      }
      const versions = await this.store.listJson<ApprovedVersion>("approved-versions");
      const current = currentVersion(versions, candidate.kind, candidate.scope.id);
      if (current?.versionId !== candidate.parentVersionId) {
        throw new StaleCandidateError(current
          ? `候选父版本已过期，当前版本为 ${current.versionId}`
          : "候选声明了不存在的父版本");
      }
    }

    const reviewId = this.runtime.id();
    const createdAt = this.runtime.now();
    const review: ReviewRecord = {
      reviewId,
      sessionId,
      ...request,
      ...(actual.reason ? { reason: actual.reason } : {}),
      createdAt,
    };
    await this.store.writeImmutable("reviews", reviewId, review);
    await this.store.appendJournal({
      type: "REVIEW_APPLIED",
      at: createdAt,
      reviewId,
      candidateId: candidate.candidateId,
      decision: request.decision,
    });

    if (request.decision !== "APPROVE") return { reviewId };

    const versionId = `${candidate.kind.toLowerCase().replaceAll("_", "-")}-${candidate.scope.id}-r${candidate.revision}`;
    const { deterministicChecks: _checks, contentHash: candidateHash, ...candidateFields } = candidate;
    const version: ApprovedVersion = {
      ...candidateFields,
      contentHash: candidateHash,
      versionId,
      candidateId: candidate.candidateId,
      candidateHash,
      reviewId,
      approvedAt: createdAt,
    };
    await this.store.writeImmutable("approved-versions", versionId, version);
    await this.store.appendJournal({
      type: "VERSION_APPROVED",
      at: createdAt,
      versionId,
      candidateId: candidate.candidateId,
      kind: candidate.kind,
      scope: candidate.scope,
      revision: candidate.revision,
      parentVersionId: candidate.parentVersionId ?? null,
      changeType: candidate.changeType,
      proposedImpactScopeIds: candidate.proposedImpactScopeIds,
    });
    return { reviewId, versionId };
  }

  private async verifyCandidateBytes(candidate: Candidate): Promise<void> {
    for (const subject of candidate.subjects) {
      const workspaceBytes = await readFile(await resolveWorkspacePath(this.workspaceRoot, subject.path));
      const snapshotBytes = await readFile(await resolveStoredSnapshotPath(this.workspaceRoot, subject.snapshotPath));
      if (
        workspaceBytes.byteLength !== subject.size
        || sha256(workspaceBytes) !== subject.sha256
        || sha256(snapshotBytes) !== subject.sha256
      ) {
        throw new StaleCandidateError(`候选文件已变化或不可变快照损坏: ${subject.path}`);
      }
    }
  }
}
