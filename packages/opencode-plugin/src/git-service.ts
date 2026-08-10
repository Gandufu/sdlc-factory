import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function readGitBase(workspaceRoot: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: workspaceRoot,
      windowsHide: true,
      timeout: 10_000,
    });
    const value = stdout.trim();
    if (!/^[a-f0-9]{40,64}$/u.test(value)) throw new Error("Git 基点格式无效");
    return value;
  } catch (error) {
    throw new Error(`编码或测试运行需要可读取的真实 Git HEAD: ${(error as Error).message}`);
  }
}
