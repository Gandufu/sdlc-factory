import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { EnvironmentService } from "../src/environment-service.js";
import { ProjectStore } from "../src/project-store.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("EnvironmentService", () => {
  it("保存实际地址、内容哈希和凭据引用，不接受明文凭据", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-environment-"));
    temporaryDirectories.push(workspace);
    const service = new EnvironmentService(new ProjectStore(workspace), {
      now: () => "2026-08-11T05:00:00.000Z",
    });

    const environment = await service.register({
      environmentId: "test",
      name: "测试环境",
      purpose: "模块与系统测试",
      profile: "REAL",
      applicationUrl: "https://test.example.com",
      readinessUrl: "https://test.example.com/health",
      externalInterfaces: [{ interfaceId: "interface-identity", address: "https://identity.example.com/api" }],
      dependencies: [],
      credentialReferences: ["env:TEST_IDENTITY_TOKEN"],
      effectiveFrom: "2026-08-11T05:00:00.000Z",
    }, "session-1");

    expect(environment).toMatchObject({
      environmentVersionId: "environment-test-r1",
      revision: 1,
      profile: "REAL",
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    await expect(service.register({
      environmentId: "unsafe",
      name: "不安全环境",
      purpose: "拒绝",
      profile: "REAL",
      applicationUrl: "https://user:password@example.com",
      externalInterfaces: [],
      dependencies: [],
      credentialReferences: ["plain-secret"],
      effectiveFrom: "2026-08-11T05:00:00.000Z",
    }, "session-1")).rejects.toThrow();
  });
});
