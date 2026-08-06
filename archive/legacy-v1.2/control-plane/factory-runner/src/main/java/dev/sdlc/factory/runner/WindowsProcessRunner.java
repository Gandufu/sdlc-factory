package dev.sdlc.factory.runner;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/**
 * Windows 原生受控子进程执行器（v1.2 首个 Runner）。
 *
 * <p>实现合同要求：</p>
 * <ul>
 *   <li>统一工作目录与环境变量；</li>
 *   <li>超时终止完整进程树并标记 timedOut；</li>
 *   <li>输出按字节读取，持久化前由上层脱敏；</li>
 *   <li>不要求用户安装 Docker Desktop。</li>
 * </ul>
 *
 * <p>注意：MVP 阶段输出捕获采用一次性读取，适合短命令（compile/test 等
 * 命令的输出由模板侧限流）；大输出场景后续切换为流式落盘 + 证据引用。</p>
 */
public final class WindowsProcessRunner implements ProjectRunner {

    private final ProcessTreeTerminator terminator;

    public WindowsProcessRunner(ProcessTreeTerminator terminator) {
        this.terminator = terminator;
    }

    @Override
    public RunnerOutput execute(RunnerCommand command) {
        ProcessBuilder builder = new ProcessBuilder(command.arguments())
                .directory(command.workingDirectory().toFile())
                // 不合并 stderr，保证两类输出分别脱敏与取证
                .redirectErrorStream(false);
        // 附加环境变量叠加在当前环境之上（Secret 由运行时通道注入）
        builder.environment().putAll(command.environment());

        try {
            Process process = builder.start();
            try (var input = process.getOutputStream()) {
                if (command.standardInput() != null) {
                    input.write(command.standardInput().getBytes(StandardCharsets.UTF_8));
                }
            }
            // stdout/stderr 必须并发消费；readAllBytes 会等待 EOF，不能放在超时判断之前
            try (ExecutorService readers = Executors.newVirtualThreadPerTaskExecutor()) {
                Future<byte[]> stdoutReader = readers.submit(process.getInputStream()::readAllBytes);
                Future<byte[]> stderrReader = readers.submit(process.getErrorStream()::readAllBytes);

                boolean finished = process.waitFor(command.timeout().toMillis(), TimeUnit.MILLISECONDS);
                if (!finished) {
                    // 超时：先终止完整进程树，使输出流到达 EOF，再汇集已产生的输出
                    terminator.terminateTree(process);
                }
                byte[] stdout = awaitOutput(stdoutReader, command.arguments().getFirst());
                byte[] stderr = awaitOutput(stderrReader, command.arguments().getFirst());
                return new RunnerOutput(finished ? process.exitValue() : -1,
                        new String(stdout, StandardCharsets.UTF_8),
                        new String(stderr, StandardCharsets.UTF_8),
                        !finished);
            }
        } catch (IOException e) {
            throw new RunnerException("进程启动失败：" + command.arguments().getFirst(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RunnerException("等待进程被中断：" + command.arguments().getFirst(), e);
        }
    }

    /** 汇集输出读取任务，并统一转换异步读取异常。 */
    private byte[] awaitOutput(Future<byte[]> reader, String executable) throws InterruptedException {
        try {
            return reader.get();
        } catch (ExecutionException e) {
            throw new RunnerException("读取进程输出失败：" + executable, e.getCause());
        }
    }
}
