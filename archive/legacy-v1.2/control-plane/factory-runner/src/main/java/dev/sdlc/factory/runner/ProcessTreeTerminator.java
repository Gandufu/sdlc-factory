package dev.sdlc.factory.runner;

import java.util.Comparator;
import java.util.concurrent.TimeUnit;

/**
 * 进程树终止器。
 *
 * <p>超时或取消时必须终止完整进程树，而不只是顶层进程：
 * 先销毁所有后代（深度优先、自深向浅），再销毁根进程，
 * 最后等待短暂宽限期确认退出。基于 JDK ProcessHandle API，
 * 在 Windows 上会覆盖子进程派生的 cmd/pnpm/java 等整棵树。</p>
 */
public final class ProcessTreeTerminator {

    /** 等待进程退出的宽限时间（秒）。 */
    private static final long GRACE_SECONDS = 5;

    /**
     * 终止给定进程的完整进程树。
     *
     * @param process 目标进程
     */
    public void terminateTree(Process process) {
        if (process == null) {
            return;
        }
        // 先终止所有后代进程，防止父进程退出后孤儿进程继续运行
        process.descendants()
                .sorted(Comparator.comparingLong(handle -> -handle.pid()))
                .forEach(handle -> handle.destroy());
        // 再终止根进程
        process.destroy();
        awaitExit(process);
        // 宽限期后仍未退出则强制结束
        if (process.isAlive()) {
            process.descendants().forEach(handle -> handle.destroyForcibly());
            process.destroyForcibly();
        }
    }

    /** 等待进程退出，忽略中断（终止动作不可半途放弃）。 */
    private void awaitExit(Process process) {
        try {
            process.waitFor(GRACE_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
