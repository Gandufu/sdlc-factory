import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { sha256 } from "./hash.js";
import { resolveWorkspacePath } from "./workspace-path.js";

const ALLOWED_EXTENSIONS = new Set([".md", ".yaml", ".yml"]);

export async function writeLifecycleDocument(
  workspaceRoot: string,
  targetPath: string,
  content: string,
): Promise<{ targetPath: string; sha256: string }> {
  const target = await resolveWorkspacePath(workspaceRoot, targetPath);
  const docsRoot = path.resolve(workspaceRoot, "docs");
  const relativeToDocs = path.relative(docsRoot, target);
  if (
    relativeToDocs === ".."
    || relativeToDocs.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativeToDocs)
    || !ALLOWED_EXTENSIONS.has(path.extname(target).toLowerCase())
  ) {
    throw new Error("生命周期文档必须是 docs 目录内的 Markdown 或 YAML 文件");
  }
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, content, { encoding: "utf8", flag: "wx" });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
  return { targetPath, sha256: sha256(Buffer.from(content, "utf8")) };
}
