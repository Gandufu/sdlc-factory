#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SdlcFactoryPlugin } from "../plugins/sdlc-factory.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const arguments_ = process.argv.slice(2);
const mode = arguments_[0];
const value = (name) => {
  const index = arguments_.indexOf(name);
  return index >= 0 ? arguments_[index + 1] : undefined;
};
const flag = (name) => arguments_.includes(name);
const target = value("--target");
const moduleName = value("--module");
const recipeTestRecordId = value("--recipe-record");
const environmentVersionId = value("--environment");

if (!new Set(["module", "system"]).has(mode) || (mode === "module" && !moduleName)) {
  process.stderr.write([
    "用法：",
    "  node .opencode/bin/sdlc-test-run.mjs module --module <完整模块名称> [--recipe-record <记录编号>] [--environment <环境版本>] [--candidate] [--target <项目路径>]",
    "  node .opencode/bin/sdlc-test-run.mjs system --environment <环境版本> [--recipe-record <记录编号>] [--candidate] [--target <项目路径>]",
    "",
    "该入口只重放已批准通过记录中的确定性命令配方，不调用模型。首次测试仍使用 /sdlc-test。",
    "",
  ].join("\n"));
  process.exitCode = 2;
} else {
  const directory = path.resolve(target ?? path.join(scriptDirectory, "..", ".."));
  const sessionID = `sdlc-test-run-cli-${Date.now()}-${process.pid}`;
  try {
    const hooks = await SdlcFactoryPlugin({
      directory,
      client: { session: { messages: async () => ({ data: [] }) } },
    });
    await hooks["command.execute.before"]?.(
      { command: "sdlc-test", sessionID, arguments: mode === "system" ? "system" : moduleName },
      { parts: [] },
    );
    const raw = await hooks.tool.sdlc_test_execute_existing.execute({
      scopeType: mode === "system" ? "SYSTEM" : "MODULE",
      ...(moduleName ? { moduleName } : {}),
      ...(recipeTestRecordId ? { recipeTestRecordId } : {}),
      ...(environmentVersionId ? { environmentVersionId } : {}),
      createCandidate: flag("--candidate"),
    }, { sessionID });
    const result = JSON.parse(raw);
    process.stdout.write(`${JSON.stringify({
      invocation: { modelCalls: 0, modelTokens: 0 },
      ...result,
    }, null, 2)}\n`);
    if (result.record?.outcome !== "PASSED") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      invocation: { modelCalls: 0, modelTokens: 0 },
      error: error instanceof Error ? error.message : String(error),
    }, null, 2)}\n`);
    process.exitCode = 1;
  }
}
