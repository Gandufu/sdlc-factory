import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { ApprovedVersion } from "../src/domain.js";
import { sha256 } from "../src/hash.js";
import { ProjectStore } from "../src/project-store.js";
import {
  ApprovedCodeDriftError,
  assertApprovedCodeIntegrity,
  currentApprovedCodeVersionIds,
} from "../src/version-integrity.js";
import { approvedVersion, writeVersions } from "./fixtures.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function withSubject(version: ApprovedVersion, subjectPath: string, content: Buffer): ApprovedVersion {
  version.subjectPaths = [subjectPath];
  version.subjects = [{
    path: subjectPath,
    sha256: sha256(content),
    size: content.byteLength,
    snapshotPath: `.sdlc-factory/objects/${version.versionId}`,
  }];
  return version;
}

describe("批准代码完整性", () => {
  it("下游依赖版本可以覆盖共享文件且两个代码版本仍有效", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-integrity-"));
    temporaryDirectories.push(workspace);
    const store = new ProjectStore(workspace);
    const subjectPath = "src/renderer/App.tsx";
    const upstreamBytes = Buffer.from("export const view = 'home';\n");
    const downstreamBytes = Buffer.from("export const view = 'device';\n");
    const upstream = withSubject(approvedVersion({
      kind: "CODE",
      scope: { type: "MODULE", id: "home", name: "首页" },
    }), subjectPath, upstreamBytes);
    const downstream = withSubject(approvedVersion({
      kind: "CODE",
      scope: { type: "MODULE", id: "device", name: "设备" },
      inputVersionIds: [upstream.versionId],
    }), subjectPath, downstreamBytes);
    await mkdir(path.join(workspace, "src", "renderer"), { recursive: true });
    await writeFile(path.join(workspace, subjectPath), downstreamBytes);
    await writeVersions(store, [upstream, downstream]);

    await expect(assertApprovedCodeIntegrity(store, workspace, [upstream.versionId, downstream.versionId]))
      .resolves.toEqual([subjectPath]);
    await expect(assertApprovedCodeIntegrity(store, workspace, [upstream.versionId]))
      .rejects.toBeInstanceOf(ApprovedCodeDriftError);
    await expect(currentApprovedCodeVersionIds(workspace, [upstream, downstream]))
      .resolves.toEqual(new Set([upstream.versionId, downstream.versionId]));
  });
});
