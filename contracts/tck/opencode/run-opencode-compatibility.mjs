import process from "node:process";
import net from "node:net";
import { pathToFileURL } from "node:url";

const { createOpencode } = await import(pathToFileURL(process.env.SDLC_OPENCODE_SDK_ENTRY));
const port = await availablePort();
const startedAt = Date.now();
const opencode = await createOpencode({ hostname: "127.0.0.1", port, timeout: 15_000, config: { logLevel: "ERROR" } });
let sessionID;
let stream;

try {
  const health = await opencode.client.global.health({ throwOnError: true });
  if (health.data?.version !== process.env.SDLC_OPENCODE_EXPECTED_VERSION) {
    throw new Error(`Host version ${health.data?.version} did not match ${process.env.SDLC_OPENCODE_EXPECTED_VERSION}`);
  }

  const subscription = await opencode.client.event.subscribe({ directory: process.env.SDLC_OPENCODE_SPIKE_DIR });
  stream = subscription.stream;
  const eventPromise = stream.next();
  const created = await opencode.client.session.create({
    directory: process.env.SDLC_OPENCODE_SPIKE_DIR,
    title: "sdlc-factory-opencode-compatibility",
  }, { throwOnError: true });
  sessionID = created.data.id;
  const firstEvent = await Promise.race([
    eventPromise,
    new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 5_000)),
  ]);
  if (firstEvent.timeout) throw new Error("OpenCode SSE did not yield an event within 5 seconds");

  const aborted = await opencode.client.session.abort({
    sessionID,
    directory: process.env.SDLC_OPENCODE_SPIKE_DIR,
  }, { throwOnError: true });
  if (aborted.data !== true) throw new Error("OpenCode session abort did not return true");

  const removed = await opencode.client.session.delete({
    sessionID,
    directory: process.env.SDLC_OPENCODE_SPIKE_DIR,
  }, { throwOnError: true });
  sessionID = undefined;
  if (removed.data !== true) throw new Error("OpenCode session delete did not return true");

  console.log(JSON.stringify({
    cliVersion: process.env.SDLC_OPENCODE_EXPECTED_VERSION,
    sdkVersion: process.env.SDLC_OPENCODE_EXPECTED_VERSION,
    health: true,
    session: true,
    sse: true,
    abort: true,
    cleanup: true,
    elapsedMs: Date.now() - startedAt,
  }));
} finally {
  if (sessionID) await opencode.client.session.delete({ sessionID, directory: process.env.SDLC_OPENCODE_SPIKE_DIR });
  if (stream) await stream.return();
  opencode.server.close();
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}
