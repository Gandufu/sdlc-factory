import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ImmutableRecordError, ProjectStore } from "../src/project-store.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("ProjectStore.writeImmutable", () => {
  it("keeps the first record when the same id is written again", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-store-"));
    temporaryDirectories.push(workspace);
    const store = new ProjectStore(workspace);

    await store.writeImmutable("candidates", "candidate-1", { value: "first" });

    await expect(
      store.writeImmutable("candidates", "candidate-1", { value: "second" }),
    ).rejects.toBeInstanceOf(ImmutableRecordError);
    await expect(
      readFile(path.join(workspace, ".sdlc-factory", "candidates", "candidate-1.json"), "utf8"),
    ).resolves.toContain('"value": "first"');
  });
});

describe("ProjectStore journal", () => {
  it("recovers complete events and ignores only an interrupted final line", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "sdlc-journal-"));
    temporaryDirectories.push(workspace);
    const store = new ProjectStore(workspace);
    await store.appendJournal({ eventId: "event-1", state: "STARTED" });
    await store.appendJournal({ eventId: "event-1", state: "SUCCEEDED" });
    const journalPath = path.join(workspace, ".sdlc-factory", "journal.jsonl");
    const original = await readFile(journalPath, "utf8");
    await import("node:fs/promises").then(({ appendFile }) => appendFile(journalPath, '{"eventId":', "utf8"));

    await expect(store.readJournal()).resolves.toEqual([
      { eventId: "event-1", state: "STARTED" },
      { eventId: "event-1", state: "SUCCEEDED" },
    ]);
    expect(original.trim().split("\n")).toHaveLength(2);
  });
});
