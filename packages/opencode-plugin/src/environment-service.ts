import type { EnvironmentVersion, TestRecord } from "./domain.js";
import { sha256 } from "./hash.js";
import type { ProjectStore } from "./project-store.js";

const STABLE_ID = /^[a-z][a-z0-9-]{1,63}$/u;
const CREDENTIAL_REFERENCE = /^(?:env|secret|keychain|vault):[A-Za-z0-9_.:/-]+$/u;
const SENSITIVE_PARAMETER = /^(?:access_token|api_key|apikey|authorization|credential|password|secret|token)$/iu;

type EnvironmentInput = Omit<EnvironmentVersion,
  "environmentVersionId" | "revision" | "contentHash" | "createdBySessionId" | "createdAt"> & {
  parentVersionId?: string;
};
type RuntimeValues = { now(): string };

export type EffectiveEnvironmentProfile = "SIMULATION" | "REAL" | "UNSPECIFIED";

export function effectiveEnvironmentProfile(environment: EnvironmentVersion): EffectiveEnvironmentProfile {
  if (environment.profile) return environment.profile;
  return /(?:模拟|mock|不代表真实|保留测试|invalid\.test)/iu.test(environment.purpose)
    ? "SIMULATION"
    : "UNSPECIFIED";
}

export function isRealAcceptanceEnvironment(environment: EnvironmentVersion): boolean {
  return effectiveEnvironmentProfile(environment) === "REAL"
    && Boolean(environment.applicationUrl)
    && !/(?:模拟|mock|不代表真实|保留测试|invalid\.test)/iu.test(environment.purpose);
}

export async function assertRealAcceptanceRecords(store: ProjectStore, testRecordIds: string[]): Promise<void> {
  for (const testRecordId of testRecordIds) {
    const record = await store.readJson<TestRecord>("test-runs", testRecordId);
    if (!record.environmentVersionId) {
      throw new Error(`正式系统验收必须绑定明确的真实环境版本: ${testRecordId}`);
    }
    const environment = await store.readJson<EnvironmentVersion>("environments", record.environmentVersionId);
    if (!isRealAcceptanceEnvironment(environment)) {
      throw new Error(`模拟或未分类环境只能形成系统测试，不能形成正式系统验收: ${environment.environmentVersionId}`);
    }
  }
}

export class EnvironmentService {
  constructor(private readonly store: ProjectStore, private readonly runtime: RuntimeValues) {}

  async register(input: EnvironmentInput, sessionId: string): Promise<EnvironmentVersion> {
    if (!STABLE_ID.test(input.environmentId) || !input.name.trim() || !input.purpose.trim()) {
      throw new Error("环境编号、名称或用途无效");
    }
    const addresses = [
      input.applicationUrl,
      input.readinessUrl,
      ...input.externalInterfaces.map((item) => item.address),
      ...input.dependencies.map((item) => item.address),
    ].filter((value): value is string => Boolean(value));
    for (const address of addresses) validateAddress(address);
    if (input.credentialReferences.some((reference) => !CREDENTIAL_REFERENCE.test(reference))) {
      throw new Error("凭据只能保存 env:、secret:、keychain: 或 vault: 引用，不能保存明文");
    }

    const versions = await this.store.listJson<EnvironmentVersion>("environments");
    const current = versions
      .filter((version) => version.environmentId === input.environmentId)
      .sort((left, right) => right.revision - left.revision)[0];
    if (current?.environmentVersionId !== input.parentVersionId) {
      throw new Error(current
        ? `环境父版本必须是当前版本: ${current.environmentVersionId}`
        : "首个环境版本不能声明父版本");
    }
    const revision = (current?.revision ?? 0) + 1;
    const content = {
      environmentId: input.environmentId,
      name: input.name.trim(),
      purpose: input.purpose.trim(),
      profile: input.profile ?? (/\bmock\b|模拟|不代表真实|保留测试|invalid\.test/iu.test(input.purpose)
        ? "SIMULATION" as const
        : "UNSPECIFIED" as const),
      ...(input.parentVersionId ? { parentVersionId: input.parentVersionId } : {}),
      ...(input.applicationUrl ? { applicationUrl: input.applicationUrl } : {}),
      ...(input.readinessUrl ? { readinessUrl: input.readinessUrl } : {}),
      externalInterfaces: [...input.externalInterfaces].sort((left, right) => left.interfaceId.localeCompare(right.interfaceId)),
      dependencies: [...input.dependencies].sort((left, right) => left.name.localeCompare(right.name)),
      credentialReferences: [...input.credentialReferences].sort(),
      effectiveFrom: input.effectiveFrom,
    };
    const environmentVersion: EnvironmentVersion = {
      environmentVersionId: `environment-${input.environmentId}-r${revision}`,
      revision,
      ...content,
      contentHash: sha256(Buffer.from(JSON.stringify(content), "utf8")),
      createdBySessionId: sessionId,
      createdAt: this.runtime.now(),
    };
    await this.store.writeImmutable("environments", environmentVersion.environmentVersionId, environmentVersion);
    await this.store.appendJournal({
      type: "ENVIRONMENT_REGISTERED",
      at: environmentVersion.createdAt,
      environmentVersionId: environmentVersion.environmentVersionId,
      environmentId: environmentVersion.environmentId,
      contentHash: environmentVersion.contentHash,
    });
    return environmentVersion;
  }
}

function validateAddress(address: string): void {
  let parsed: URL;
  try {
    parsed = new URL(address);
  } catch {
    throw new Error(`环境地址不是有效绝对地址: ${address}`);
  }
  if (parsed.username || parsed.password) throw new Error("环境地址不能包含用户名或密码");
  for (const key of parsed.searchParams.keys()) {
    if (SENSITIVE_PARAMETER.test(key)) throw new Error(`环境地址不能包含敏感查询参数: ${key}`);
  }
}
