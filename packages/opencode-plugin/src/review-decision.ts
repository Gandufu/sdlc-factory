export class ReviewDecisionError extends Error {}

export type ReviewDecision = {
  decision: "APPROVE" | "REVISE" | "HOLD";
  candidateId: string;
  candidateHash: string;
  reason?: string;
};

export function parseReviewDecision(message: string): ReviewDecision {
  const match = /^(通过|退回|暂缓)\s+(\S+)\s+([a-f0-9]{64})(?:\s*[：:]\s*(.+))?$/u.exec(message.trim());
  if (!match) {
    throw new ReviewDecisionError("Review decision must contain a candidate id and full SHA-256 hash");
  }

  const [, verb, candidateId, candidateHash, reason] = match;
  if (verb === "退回" && !reason?.trim()) {
    throw new ReviewDecisionError("A revision decision must include a reason");
  }
  if (verb === "暂缓" && !reason?.trim()) {
    throw new ReviewDecisionError("A hold decision must include its concern");
  }

  const decision = verb === "通过" ? "APPROVE" : verb === "退回" ? "REVISE" : "HOLD";
  return reason
    ? { decision, candidateId: candidateId!, candidateHash: candidateHash!, reason: reason.trim() }
    : { decision, candidateId: candidateId!, candidateHash: candidateHash! };
}
