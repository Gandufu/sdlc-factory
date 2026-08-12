export const ARTIFACT_KINDS = [
  "PRODUCT_BRIEF",
  "REQUIREMENT_MAP",
  "MODULE_REQUIREMENT",
  "INTERFACE_REQUIREMENT",
  "QUALITY_REQUIREMENT",
  "REQUIREMENT_SET",
  "PRODUCT_ARCHITECTURE",
  "MODULE_DESIGN",
  "INTERFACE_DESIGN",
  "DESIGN_SET",
  "CODE",
  "MODULE_TEST",
  "SYSTEM_TEST",
  "SYSTEM_ACCEPTANCE",
] as const;

export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];
export type ScopeType = "PROJECT" | "MODULE" | "INTERFACE" | "QUALITY" | "SYSTEM";
export type ChangeType = "EDITORIAL" | "CLARIFICATION" | "BEHAVIOR" | "STRUCTURE";
export type ReviewDecision = "APPROVE" | "REVISE" | "HOLD";
export type RunState = "STARTED" | "SUCCEEDED" | "FAILED" | "BLOCKED";
export type TestOutcome = "PASSED" | "FAILED" | "SKIPPED" | "BLOCKED";

export type ArtifactScope = {
  type: ScopeType;
  id: string;
  name: string;
};

export type ArtifactSubject = {
  path: string;
  sha256: string;
  size: number;
  snapshotPath: string;
};

export type BusinessModule = {
  moduleId: string;
  name: string;
  slug: string;
  goal: string;
  functionalGroups: string[];
  dependencies: string[];
  interfaceIds: string[];
  qualityIds: string[];
  status: "ACTIVE" | "RETIRED";
  derivedFromModuleIds?: string[];
};

export type InterfaceRequirement = {
  interfaceId: string;
  name: string;
  slug: string;
  scopeModuleIds: string[];
};

export type QualityRequirement = {
  qualityId: string;
  name: string;
  slug: string;
  scope: "GLOBAL" | "MODULES";
  scopeModuleIds: string[];
};

export type RequirementMapFacts = {
  businessModules: BusinessModule[];
  interfaces: InterfaceRequirement[];
  qualityRequirements: QualityRequirement[];
};

export type ModuleDesignFacts = {
  productPaths: string[];
  testPaths: string[];
};

export type VersionSetFacts = {
  componentVersionIds: string[];
};

export type CandidateFacts = RequirementMapFacts | ModuleDesignFacts | VersionSetFacts;

export type CandidateProvenance = {
  runId: string;
  gitBase: string;
  inputVersionIds: string[];
  testRecordIds: string[];
};

export type Candidate = {
  candidateId: string;
  kind: ArtifactKind;
  scope: ArtifactScope;
  revision: number;
  parentVersionId?: string;
  contentHash: string;
  subjectPaths: string[];
  subjects: ArtifactSubject[];
  inputVersionIds: string[];
  sourceIds: string[];
  testRecordIds: string[];
  changeType: ChangeType;
  changeSummary: string;
  proposedImpactScopeIds: string[];
  deterministicChecks: DeterministicCheck[];
  facts?: CandidateFacts;
  provenance?: CandidateProvenance;
  createdBySessionId: string;
  createdAt: string;
};

export type DeterministicCheck = {
  check: string;
  status: "PASSED" | "FAILED";
  detail: string;
};

export type ReviewRecord = {
  reviewId: string;
  candidateId: string;
  candidateHash: string;
  decision: ReviewDecision;
  reason?: string;
  sessionId: string;
  createdAt: string;
};

export type ApprovedVersion = Omit<Candidate, "deterministicChecks"> & {
  versionId: string;
  candidateId: string;
  candidateHash: string;
  reviewId: string;
  approvedAt: string;
};

export type ProjectManifest = {
  schemaVersion: 2;
  pluginVersion: string;
  projectName: string;
  workspaceRoot: string;
  allowedReadRoots: string[];
  allowedExecutables: string[];
  initializedBySessionId: string;
  initializedAt: string;
};

export type RunRecord = {
  runId: string;
  command: string;
  commandType: "CODE" | "MODULE_TEST" | "SYSTEM_TEST";
  sessionId: string;
  scope: ArtifactScope;
  gitBase: string;
  inputVersionIds: string[];
  allowedProductPaths: string[];
  allowedTestPaths: string[];
  createdAt: string;
};

export type CommandEvidence = {
  evidenceId: string;
  runId: string;
  executable: string;
  arguments: string[];
  workingDirectory: string;
  exitCode: number | null;
  timedOut: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  stdoutPath: string;
  stdoutHash: string;
  stderrPath: string;
  stderrHash: string;
};

export type EnvironmentVersion = {
  environmentVersionId: string;
  environmentId: string;
  name: string;
  purpose: string;
  profile?: "SIMULATION" | "REAL" | "UNSPECIFIED";
  revision: number;
  parentVersionId?: string;
  applicationUrl?: string;
  readinessUrl?: string;
  externalInterfaces: Array<{ interfaceId: string; address: string }>;
  dependencies: Array<{ name: string; address: string; version?: string }>;
  credentialReferences: string[];
  effectiveFrom: string;
  contentHash: string;
  createdBySessionId: string;
  createdAt: string;
};

export type TestRecord = {
  testRecordId: string;
  scope: ArtifactScope;
  runId: string;
  outcome: TestOutcome;
  inputVersionIds: string[];
  environmentVersionId?: string;
  environmentHash?: string;
  resolvedAddresses: string[];
  commandEvidenceIds: string[];
  passedCommands: number;
  failedCommands: number;
  skippedCommands: number;
  blockedCommands: number;
  assertionCountsAvailable: boolean;
  fingerprintFiles?: Array<{ path: string; sha256: string; size: number }>;
  evidencePaths: Array<{ path: string; sha256: string; size: number }>;
  fingerprint: string;
  reusedFromTestRecordId?: string;
  startedAt: string;
  finishedAt: string;
  createdAt: string;
};

export type JournalEvent = Record<string, unknown> & {
  type: string;
  at: string;
};
