package dev.sdlc.factory.runner;

import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 执行器命令。
 *
 * <p>命令只允许来自已发布的 TemplateRegistration 或 Project Runtime Adapter；
 * Runner 不接受 Agent 直接提交的任意 Shell（v1.2 §9.1）。</p>
 *
 * @param arguments     命令行参数列表（首元素为可执行文件）
 * @param workingDirectory 规范化工作目录
 * @param environment   附加环境变量（Secret 通过运行时通道注入，不落日志）
 * @param timeout       单次运行超时
 */
public record RunnerCommand(
        List<String> arguments,
        Path workingDirectory,
        Map<String, String> environment,
        Duration timeout) {

    public RunnerCommand {
        Objects.requireNonNull(arguments, "arguments 不能为空");
        Objects.requireNonNull(workingDirectory, "workingDirectory 不能为空");
        Objects.requireNonNull(timeout, "timeout 不能为空");
        arguments = List.copyOf(arguments);
        if (arguments.isEmpty()) {
            throw new IllegalArgumentException("命令行不能为空");
        }
        environment = environment == null ? Map.of() : Map.copyOf(environment);
        if (timeout.isNegative() || timeout.isZero()) {
            throw new IllegalArgumentException("超时必须为正数");
        }
    }
}
