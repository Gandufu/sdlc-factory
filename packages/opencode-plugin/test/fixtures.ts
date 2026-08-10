import type {
  ApprovedVersion,
  ArtifactKind,
  ArtifactScope,
  CandidateFacts,
  ProjectManifest,
  RequirementMapFacts,
} from "../src/domain.js";
import type { ProjectStore } from "../src/project-store.js";

export const HASH_A = "a".repeat(64);

export const requirementMapFacts: RequirementMapFacts = {
  businessModules: [
    {
      moduleId: "module-system-management",
      name: "系统管理",
      slug: "system-management",
      goal: "管理用户、角色和系统配置",
      functionalGroups: ["用户管理", "角色权限"],
      dependencies: [],
      interfaceIds: ["interface-identity"],
      qualityIds: ["quality-security"],
      status: "ACTIVE",
    },
  ],
  interfaces: [
    {
      interfaceId: "interface-identity",
      name: "统一身份接口",
      slug: "identity",
      scopeModuleIds: ["module-system-management"],
    },
  ],
  qualityRequirements: [
    {
      qualityId: "quality-security",
      name: "全局安全要求",
      slug: "security",
      scope: "GLOBAL",
      scopeModuleIds: [],
    },
  ],
};

export function approvedVersion(input: {
  kind: ArtifactKind;
  scope: ArtifactScope;
  revision?: number;
  inputVersionIds?: string[];
  testRecordIds?: string[];
  facts?: CandidateFacts;
  versionId?: string;
}): ApprovedVersion {
  const revision = input.revision ?? 1;
  const versionId = input.versionId
    ?? `${input.kind.toLowerCase().replaceAll("_", "-")}-${input.scope.id}-r${revision}`;
  return {
    versionId,
    candidateId: `candidate-${versionId}`,
    candidateHash: HASH_A,
    reviewId: `review-${versionId}`,
    kind: input.kind,
    scope: input.scope,
    revision,
    contentHash: HASH_A,
    subjectPaths: [],
    subjects: [],
    inputVersionIds: input.inputVersionIds ?? [],
    sourceIds: [],
    testRecordIds: input.testRecordIds ?? [],
    changeType: "BEHAVIOR",
    changeSummary: "测试版本",
    proposedImpactScopeIds: [],
    ...(input.facts ? { facts: input.facts } : {}),
    createdBySessionId: "session-fixture",
    createdAt: "2026-08-11T00:00:00.000Z",
    approvedAt: "2026-08-11T00:01:00.000Z",
  };
}

export async function writeManifest(store: ProjectStore, workspaceRoot: string): Promise<void> {
  const manifest: ProjectManifest = {
    schemaVersion: 2,
    pluginVersion: "0.1.0",
    projectName: "测试项目",
    workspaceRoot,
    allowedReadRoots: [],
    allowedExecutables: ["node"],
    initializedBySessionId: "session-fixture",
    initializedAt: "2026-08-11T00:00:00.000Z",
  };
  await store.writeManifest(manifest);
}

export async function writeVersions(store: ProjectStore, versions: ApprovedVersion[]): Promise<void> {
  for (const version of versions) await store.writeImmutable("approved-versions", version.versionId, version);
}
