import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const { default: Ajv2020 } = await import(pathToFileURL(process.env.SDLC_AJV_MODULE));
const { default: addFormats } = await import(pathToFileURL(process.env.SDLC_AJV_FORMATS_MODULE));
const root = process.env.SDLC_CONTRACTS_ROOT;
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
addFormats(ajv);

const validate = Object.fromEntries([
  "host-run-event", "host-run-result", "handoff", "evidence", "execution-result", "runtime-lease", "error-envelope",
].map((name) => [name, ajv.compile(readJson(path.join(root, "json-schema", `${name}.schema.json`)))]));

const invocation = readJson(path.join(root, "examples", "valid", "agent-invocation.json"));
const runRequest = readJson(path.join(root, "examples", "valid", "run-request.json"));
const fakeHost = path.join(root, "tck", "fakes", "fake-host-adapter.mjs");
const fakeRunner = path.join(root, "tck", "fakes", "fake-runner.mjs");

const hostSuccess = invoke(fakeHost, "success", invocation);
assertValid("host-run-event", hostSuccess.event);
assertValid("handoff", hostSuccess.handoff);
assertValid("host-run-result", hostSuccess.result);
assertEqual(hostSuccess, invoke(fakeHost, "success", invocation), "Fake Host idempotent replay");

const hostInvalid = invoke(fakeHost, "invalid-structured", invocation);
assertValid("host-run-event", hostInvalid.event);
assertValid("error-envelope", hostInvalid.error);
assertValid("host-run-result", hostInvalid.result);
assert(hostInvalid.result.status === "FAILED", "Invalid structured output must fail");

const runnerTest = invoke(fakeRunner, "test-success", runRequest);
assertValid("evidence", runnerTest.evidence);
assertValid("execution-result", runnerTest.result);
assertEqual(runnerTest, invoke(fakeRunner, "test-success", runRequest), "Fake Runner idempotent replay");

const runnerStart = invoke(fakeRunner, "start-success", runRequest);
assertValid("evidence", runnerStart.evidence);
assertValid("runtime-lease", runnerStart.lease);
assertValid("execution-result", runnerStart.result);

const runnerTimeout = invoke(fakeRunner, "timeout", runRequest);
assertValid("evidence", runnerTimeout.evidence);
assertValid("error-envelope", runnerTimeout.error);
assertValid("execution-result", runnerTimeout.result);
assert(runnerTimeout.result.operation_status === "TIMED_OUT", "Timeout scenario must not report success");

console.log(JSON.stringify({ hostScenarios: 2, runnerScenarios: 3, idempotentReplay: true, schemaValidation: true }));

function invoke(file, scenario, input) {
  const execution = spawnSync(process.execPath, [file, scenario], { input: JSON.stringify(input), encoding: "utf8" });
  if (execution.status !== 0) throw new Error(execution.stderr || `Adapter exited ${execution.status}`);
  return JSON.parse(execution.stdout);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function assertValid(name, value) {
  if (!validate[name](value)) throw new Error(`${name} failed: ${ajv.errorsText(validate[name].errors)}`);
}

function assertEqual(left, right, label) {
  assert(JSON.stringify(left) === JSON.stringify(right), label);
}

function assert(condition, label) {
  if (!condition) throw new Error(label);
}
