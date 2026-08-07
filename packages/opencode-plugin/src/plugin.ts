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
      description: "Read a previously snapshotted text source by its stable source id.",
      args: { sourceId: tool.schema.string().min(1) },
      async execute(args) {
        const store = new ProjectStore(directory);
        const snapshot = await store.readJson<{
          sourceId: string;
          originalPath: string;
          snapshotPath: string;
          sha256: string;
        }>("sources", args.sourceId);
        return JSON.stringify({
          sourceId: snapshot.sourceId,
          originalPath: snapshot.originalPath,
          sha256: snapshot.sha256,
          content: await readFile(snapshot.snapshotPath, "utf8"),
        });
      },
    }),
    sdlc_status: tool({
      description: "Read deterministic SDLC Factory project status.",
      args: {},
      async execute() {
        const initialized = existsSync(path.join(directory, ".sdlc-factory", "manifest.json"));
        return JSON.stringify(initialized
          ? { initialized: true }
          : {
              initialized: false,
              recommendedAction: {
                action: "INIT",
                todo: "执行 /sdlc-init",
                command: "/sdlc-init",
              },
            });
      },
    }),
  },
});
