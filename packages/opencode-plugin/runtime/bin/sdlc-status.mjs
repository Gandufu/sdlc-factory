#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SdlcFactoryPlugin } from "../plugins/sdlc-factory.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const targetIndex = process.argv.indexOf("--target");
const target = targetIndex >= 0 ? process.argv[targetIndex + 1] : undefined;
const directory = path.resolve(target ?? path.join(scriptDirectory, "..", ".."));
const hooks = await SdlcFactoryPlugin({ directory });
const result = await hooks.tool.sdlc_status.execute({}, { sessionID: "sdlc-status-cli" });
process.stdout.write(`${JSON.stringify(JSON.parse(result), null, 2)}\n`);
