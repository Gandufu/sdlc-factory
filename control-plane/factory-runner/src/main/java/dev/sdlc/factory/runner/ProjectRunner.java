package dev.sdlc.factory.runner;

/**
 * 项目执行器接口（v1.2 §2.2 外部接缝之一）。
 *
 * <p>首个实现为 Windows 原生受控子进程；
 * Dagger、Docker 或远程执行器只能通过同一 TCK 后作为后续 Adapter 加入。</p>
 */
public interface ProjectRunner {

    /**
     * 同步执行一条受控命令并返回原始输出。
     *
     * <p>实现必须保证：统一工作目录与环境、超时终止完整进程树、
     * 输出脱敏、退出码与证据采集。</p>
     *
     * @param command 执行器命令
     * @return 执行输出
     * @throws RunnerException 进程无法启动等基础设施错误
     */
    RunnerOutput execute(RunnerCommand command);
}
