package dev.sdlc.factory.runner;

import java.util.Objects;

/**
 * 执行器原始输出（脱敏前不得持久化）。
 *
 * @param exitCode 进程退出码
 * @param stdout   标准输出（已脱敏）
 * @param stderr   标准错误（已脱敏）
 * @param timedOut 是否因超时被终止
 */
public record RunnerOutput(int exitCode, String stdout, String stderr, boolean timedOut) {

    public RunnerOutput {
        Objects.requireNonNull(stdout, "stdout 不能为空");
        Objects.requireNonNull(stderr, "stderr 不能为空");
    }
}
