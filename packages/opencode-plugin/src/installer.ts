import { access, cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export class InstallationConflictError extends Error {}

export async function installRuntime(runtimeRoot: string, targetRoot: string, version: string): Promise<void> {
  const configRoot = path.join(targetRoot, ".opencode");
  const pluginTarget = path.join(configRoot, "plugins", "sdlc-factory.js");
  const manifestTarget = path.join(configRoot, "sdlc-factory-install.json");
  if (await exists(pluginTarget) && !(await exists(manifestTarget))) {
    throw new InstallationConflictError(`Refusing to overwrite unmanaged file: ${pluginTarget}`);
  }
  await mkdir(configRoot, { recursive: true });
  if (await exists(manifestTarget)) {
    for (const legacyDirectory of [
      "sdlc-requirement-analysis",
      "sdlc-overall-design",
      "sdlc-cu-coding",
      "sdlc-cu-testing",
    ]) {
      await rm(path.join(configRoot, "skills", legacyDirectory), { recursive: true, force: true });
    }
  }
  await cp(runtimeRoot, configRoot, { recursive: true, force: true });
  await writeFile(
    manifestTarget,
    `${JSON.stringify({ version }, null, 2)}\n`,
    "utf8",
  );
}

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}
