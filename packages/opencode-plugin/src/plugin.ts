import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { tool, type Plugin } from "@opencode-ai/plugin";

import { ProjectStore } from "./project-store.js";
import { SourceService } from "./source-service.js";

export const SdlcFactoryPlugin: Plugin = async ({ directory }) => ({
  tool: {
    sdlc_init: tool({
      description: "Initialize deterministic SDLC Factory project state.",
      args: {
        projectName: tool.schema.string().min(1),
        allowedReadRoots: tool.schema.array(tool.schema.string()).default([]),
      },
      async execute(args, context) {
        const store = new ProjectStore(directory);
        await store.writeManifest({
          schemaVersion: 1,
          pluginVersion: "0.0.1",
          projectName: args.projectName,
          workspaceRoot: directory,
          allowedReadRoots: args.allowedReadRoots,
          initializedBySessionId: context.sessionID,
        });
        await store.appendJournal({
          type: "PROJECT_INITIALIZED",
          sessionId: context.sessionID,
          projectName: args.projectName,
        });
        return JSON.stringify({ initialized: true });
      },
    }),
    sdlc_source_snapshot: tool({
      description: "Snapshot an explicitly authorized external source into immutable project state.",
      args: {
        sourceId: tool.schema.string().min(1),
        sourcePath: tool.schema.string().min(1),
      },
      async execute(args) {
        const store = new ProjectStore(directory);
        const manifest = await store.readManifest<{ allowedReadRoots: string[] }>();
        const snapshot = await new SourceService(
          store,
          directory,
          manifest.allowedReadRoots,
        ).snapshot(args.sourceId, args.sourcePath);
        return JSON.stringify(snapshot);
      },
    }),
    sdlc_source_read: tool({
      description: "Read a bounded page from a snapshotted text source by stable source id.",
      args: {
        sourceId: tool.schema.string().min(1),
        offset: tool.schema.number().int().nonnegative().default(0),
        limit: tool.schema.number().int().min(1).max(12000).default(12000),
      },
      async execute(args) {
        const store = new ProjectStore(directory);
        const snapshot = await store.readJson<{
          sourceId: string;
          originalPath: string;
          snapshotPath: string;
          sha256: string;
        }>("sources", args.sourceId);
        const text = await readFile(snapshot.snapshotPath, "utf8");
        const offset = args.offset ?? 0;
        const limit = args.limit ?? 12000;
        const nextOffset = Math.min(offset + limit, text.length);
        return JSON.stringify({
          sourceId: snapshot.sourceId,
          originalPath: snapshot.originalPath,
          sha256: snapshot.sha256,
          content: text.slice(offset, nextOffset),
          offset,
          nextOffset,
          totalLength: text.length,
          complete: nextOffset >= text.length,
        });
      },
    }),
    sdlc_status: tool({
      description: "Read deterministic SDLC Factory project status.",
      args: {},
      async execute() {
        const initialized = existsSync(path.join(directory, ".sdlc-factory", "manifest.json"));
        if (!initialized) {
          return JSON.stringify({
              initialized: false,
              recommendedAction: {
                action: "INIT",
                todo: "执行 /sdlc-init",
                command: "/sdlc-init",
              },
            });
        }
        const store = new ProjectStore(directory);
        const sources = await store.listJson<{ sourceId: string; sha256: string }>("sources");
        return JSON.stringify(sources.length > 0
          ? { initialized: true, registeredSources: sources.map(({ sourceId, sha256 }) => ({ sourceId, sha256 })) }
          : { initialized: true });
      },
    }),
  },
});
