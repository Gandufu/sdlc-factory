#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import { installRuntime } from "./installer.js";

const [, , command, ...arguments_] = process.argv;
const targetIndex = arguments_.indexOf("--target");
const target = targetIndex >= 0 ? arguments_[targetIndex + 1] : undefined;

if (command !== "install" || !target) {
  console.error("Usage: sdlc-factory-plugin install --target <absolute-project-path>");
  process.exitCode = 2;
} else {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const runtimeRoot = path.resolve(scriptDirectory, "..", "runtime");
  const migration = await installRuntime(runtimeRoot, path.resolve(target), "0.1.0");
  console.log(`Installed SDLC Factory Plugin 0.1.0 into ${path.resolve(target)}`);
  if (migration.removedLegacyDirectory) {
    console.log(
      `Migrated ${migration.migratedLegacyFiles} legacy snapshots and indexed ${migration.indexedLegacyReferences} references.`,
    );
  }
}
