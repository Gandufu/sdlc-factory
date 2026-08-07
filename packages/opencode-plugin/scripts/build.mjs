import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { build } from "esbuild";

const packageRoot = path.resolve(import.meta.dirname, "..");
await mkdir(path.join(packageRoot, "runtime", "plugins"), { recursive: true });
await mkdir(path.join(packageRoot, "dist"), { recursive: true });

await build({
  entryPoints: [path.join(packageRoot, "src", "plugin.ts")],
  outfile: path.join(packageRoot, "runtime", "plugins", "sdlc-factory.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  minifyWhitespace: true,
  sourcemap: false,
});

const pluginBundle = path.join(packageRoot, "runtime", "plugins", "sdlc-factory.js");
const pluginSource = await readFile(pluginBundle, "utf8");
await writeFile(pluginBundle, pluginSource.replace(/[ \t]+$/gmu, ""), "utf8");

await build({
  entryPoints: [path.join(packageRoot, "src", "cli.ts")],
  outfile: path.join(packageRoot, "dist", "cli.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  sourcemap: false,
});
