import { describe, expect, it } from "vitest";

import { ReviewDecisionError, parseReviewDecision } from "../src/review-decision.js";

const candidateId = "candidate-7";
const hash = "a".repeat(64);

describe("parseReviewDecision", () => {
  it("rejects an approval that does not contain the full candidate hash", () => {
    expect(() => parseReviewDecision(`通过 ${candidateId} ${hash.slice(0, 12)}`)).toThrow(
      ReviewDecisionError,
    );
  });

  it("parses a direct approval containing the candidate id and full hash", () => {
    expect(parseReviewDecision(`通过 ${candidateId} ${hash}`)).toEqual({
      decision: "APPROVE",
      candidateId,
      candidateHash: hash,
    });
  });
});
