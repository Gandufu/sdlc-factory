import type { ProjectStore } from "./project-store.js";
import { parseReviewDecision } from "./review-decision.js";

export class ReviewMismatchError extends Error {}

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
    private readonly sessionMessages: SessionMessages,
    private readonly runtime: RuntimeValues,
  ) {}

  async apply(sessionId: string, request: ReviewRequest): Promise<{ reviewId: string; baselineId?: string }> {
    const candidate = await this.store.readJson<{ kind: string; contentHash: string }>(
      "candidates",
      request.candidateId,
    );
    const actual = parseReviewDecision(await this.sessionMessages.latestUserText(sessionId));
    if (
      actual.candidateId !== request.candidateId
      || actual.candidateHash !== request.candidateHash
      || actual.decision !== request.decision
      || candidate.contentHash !== request.candidateHash
    ) {
      throw new ReviewMismatchError("Review request does not match the actual user message and candidate");
    }
    const reviewId = this.runtime.id();
    const baselineId = `${candidate.kind.toLowerCase()}-${request.candidateId}`;
    await this.store.writeImmutable("reviews", reviewId, {
      reviewId,
      sessionId,
      ...request,
      createdAt: this.runtime.now(),
    });
    if (request.decision === "APPROVE") {
      await this.store.writeImmutable("baselines", baselineId, {
        baselineId,
        candidateId: request.candidateId,
        candidateHash: request.candidateHash,
        reviewId,
        createdAt: this.runtime.now(),
      });
      return { reviewId, baselineId };
    }
    return { reviewId };
  }
}
