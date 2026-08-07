import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { SdlcFactoryPlugin } from "../src/plugin.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("SdlcFactoryPlugin", () => {
  it("returns an initialization recommendation without creating project state", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "sdlc-plugin-"));
    temporaryDirectories.push(directory);
    const hooks = await SdlcFactoryPlugin({ directory } as never);
    const statusTool = hooks.tool?.sdlc_status;

    const result = await statusTool!.execute({}, { sessionID: "session-1" } as never);

    expect(JSON.parse(result as string)).toEqual({
      initialized: false,
      recommendedAction: {
        action: "INIT",
        todo: "执行 /sdlc-init",
        command: "/sdlc-init",
      },
    });
  });

  it("initializes deterministic project state before status becomes confirmed", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "sdlc-plugin-"));
    temporaryDirectories.push(directory);
    const hooks = await SdlcFactoryPlugin({ directory } as never);

    await hooks.tool!.sdlc_init!.execute(
      { projectName: "直升机会议终端", allowedReadRoots: [] },
      { sessionID: "session-1" } as never,
    );
    const status = await hooks.tool!.sdlc_status!.execute({}, { sessionID: "session-1" } as never);

    expect(JSON.parse(status as string)).toEqual({ initialized: true });
  });

  it("snapshots and reads only explicitly authorized requirement sources", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "sdlc-plugin-"));
    const sourceRoot = await mkdtemp(path.join(tmpdir(), "sdlc-plugin-source-"));
    temporaryDirectories.push(directory, sourceRoot);
    const sourcePath = path.join(sourceRoot, "requirements.md");
    await writeFile(sourcePath, "真实需求\r\n", "utf8");
    const hooks = await SdlcFactoryPlugin({ directory } as never);
    await hooks.tool!.sdlc_init!.execute(
      { projectName: "直升机会议终端", allowedReadRoots: [sourceRoot] },
      { sessionID: "session-1" } as never,
    );

    await hooks.tool!.sdlc_source_snapshot!.execute(
      { sourceId: "source-requirements", sourcePath },
      { sessionID: "session-1" } as never,
    );
    const result = await hooks.tool!.sdlc_source_read!.execute(
      { sourceId: "source-requirements" },
      { sessionID: "session-1" } as never,
    );

    expect(JSON.parse(result as string)).toMatchObject({
      sourceId: "source-requirements",
      content: "真实需求\r\n",
    });
  });
});
