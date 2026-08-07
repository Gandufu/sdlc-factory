import { randomUUID } from "node:crypto";
import { link, mkdir, open, readFile, rm } from "node:fs/promises";
import path from "node:path";

export class ImmutableRecordError extends Error {}

export class ProjectStore {
  readonly stateRoot: string;

  constructor(workspaceRoot: string) {
    this.stateRoot = path.join(workspaceRoot, ".sdlc-factory");
  }

  async writeImmutable(collection: string, id: string, value: unknown): Promise<string> {
    const directory = path.join(this.stateRoot, collection);
    const target = path.join(directory, `${id}.json`);
    const temporary = path.join(directory, `.${id}.${randomUUID()}.tmp`);
    await mkdir(directory, { recursive: true });
    const handle = await open(temporary, "wx");
    try {
      await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }

    try {
      await link(temporary, target);
      return target;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EEXIST") {
        throw new ImmutableRecordError(`Immutable record already exists: ${collection}/${id}`);
      }
      throw error;
    } finally {
      await rm(temporary, { force: true });
    }
  }

  async readJson<T>(collection: string, id: string): Promise<T> {
    return JSON.parse(await readFile(path.join(this.stateRoot, collection, `${id}.json`), "utf8")) as T;
  }

  async appendJournal(event: unknown): Promise<void> {
    await mkdir(this.stateRoot, { recursive: true });
    const handle = await open(path.join(this.stateRoot, "journal.jsonl"), "a");
    try {
      await handle.writeFile(`${JSON.stringify(event)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  async readJournal<T = unknown>(): Promise<T[]> {
    const content = await readFile(path.join(this.stateRoot, "journal.jsonl"), "utf8");
    const lines = content.split("\n");
    const events: T[] = [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!.trim();
      if (!line) continue;
      try {
        events.push(JSON.parse(line) as T);
      } catch (error) {
        const isLastNonEmptyLine = lines.slice(index + 1).every((remaining) => !remaining.trim());
        if (!isLastNonEmptyLine) throw error;
      }
    }
    return events;
  }
}
