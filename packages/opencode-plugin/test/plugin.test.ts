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
    const status = await hooks.tool!.sdlc_status!.execute({}, { sessionID: "session-1" } as never);
    const result = await hooks.tool!.sdlc_source_read!.execute(
      { sourceId: "source-requirements" },
      { sessionID: "session-1" } as never,
    );

    expect(JSON.parse(result as string)).toMatchObject({
      sourceId: "source-requirements",
      content: "真实需求\r\n",
    });
    expect(JSON.parse(status as string)).toMatchObject({
      initialized: true,
      registeredSources: [
        { sourceId: "source-requirements", sha256: expect.stringMatching(/^[a-f0-9]{64}$/u) },
      ],
    });
  });

  it("reads large source snapshots in deterministic bounded pages", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "sdlc-plugin-"));
    const sourceRoot = await mkdtemp(path.join(tmpdir(), "sdlc-plugin-source-"));
    temporaryDirectories.push(directory, sourceRoot);
    const sourcePath = path.join(sourceRoot, "protocol.md");
    await writeFile(sourcePath, "0123456789", "utf8");
    const hooks = await SdlcFactoryPlugin({ directory } as never);
    await hooks.tool!.sdlc_init!.execute(
      { projectName: "直升机会议终端", allowedReadRoots: [sourceRoot] },
      { sessionID: "session-1" } as never,
    );
    await hooks.tool!.sdlc_source_snapshot!.execute(
      { sourceId: "source-api", sourcePath },
      { sessionID: "session-1" } as never,
    );

    const first = JSON.parse(await hooks.tool!.sdlc_source_read!.execute(
      { sourceId: "source-api", offset: 0, limit: 4 },
      { sessionID: "session-1" } as never,
    ) as string);
    const second = JSON.parse(await hooks.tool!.sdlc_source_read!.execute(
      { sourceId: "source-api", offset: first.nextOffset, limit: 4 },
      { sessionID: "session-1" } as never,
    ) as string);

    expect(first).toMatchObject({ content: "0123", offset: 0, nextOffset: 4, complete: false });
    expect(second).toMatchObject({ content: "4567", offset: 4, nextOffset: 8, complete: false });
  });
});
