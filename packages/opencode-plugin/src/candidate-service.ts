import { readFile } from "node:fs/promises";

import { sha256 } from "./hash.js";
import type { ProjectStore } from "./project-store.js";
import { resolveWorkspacePath } from "./workspace-path.js";

type CandidateKind = "REQUIREMENT" | "DESIGN" | "CODE" | "TEST" | "SYSTEM_ACCEPTANCE";

type Candidate = {
  candidateId: string;
  kind: CandidateKind;
  contentHash: string;
  subjectPaths: string[];
  subjects: Array<{ path: string; sha256: string; size: number }>;
  provenance?: CandidateProvenance;
  createdAt: string;
};

export type CandidateProvenance = {
  runId: string;
  gitBase: string;
  cuName: string;
  inputBaselineIds: string[];
};

type RuntimeValues = {
  id(): string;
  now(): string;
};

export class CandidateService {
  constructor(
    private readonly store: ProjectStore,
    private readonly workspaceRoot: string,
    private readonly runtime: RuntimeValues,
  ) {}

  async createDocumentCandidate(
    kind: CandidateKind,
    subjectPaths: string[],
    provenance?: CandidateProvenance,
  ): Promise<Candidate> {
    if (subjectPaths.length === 0) {
      throw new Error("A document candidate requires at least one subject path");
    }

    const subjects = await Promise.all(
      subjectPaths.map(async (subjectPath) => {
        const resolved = await resolveWorkspacePath(this.workspaceRoot, subjectPath);
        const bytes = await readFile(resolved);
        return { path: subjectPath, sha256: sha256(bytes), size: bytes.byteLength };
      }),
    );
    const contentHash = provenance
      ? sha256(Buffer.from(JSON.stringify({ subjects, provenance }), "utf8"))
      : subjects.length === 1
      ? subjects[0]!.sha256
      : sha256(Buffer.from(JSON.stringify(subjects), "utf8"));
    const candidate: Candidate = {
      candidateId: this.runtime.id(),
      kind,
      contentHash,
      subjectPaths,
      subjects,
      ...(provenance ? { provenance } : {}),
      createdAt: this.runtime.now(),
    };
    await this.store.writeImmutable("candidates", candidate.candidateId, candidate);
    return candidate;
  }
}
