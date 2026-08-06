package dev.sdlc.factory.runner;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledOnOs;
import org.junit.jupiter.api.condition.OS;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Windows 原生 Runner 测试：仅在 Windows 上执行。
 */
@EnabledOnOs(OS.WINDOWS)
class WindowsProcessRunnerTest {

    private final WindowsProcessRunner runner = new WindowsProcessRunner(new ProcessTreeTerminator());

    @TempDir
    Path workDir;

    @Test
    void shouldCaptureOutputAndExitCode() {
        RunnerCommand command = new RunnerCommand(
                List.of("cmd", "/c", "echo", "factory"), workDir, null, Duration.ofSeconds(30));

        RunnerOutput output = runner.execute(command);

        assertEquals(0, output.exitCode());
        assertFalse(output.timedOut());
        assertTrue(output.stdout().contains("factory"));
    }

    @Test
    void shouldTerminateOnTimeout() {
        // ping -n 30 会持续约 30 秒，2 秒超时必然触发进程树终止
        RunnerCommand command = new RunnerCommand(
                List.of("cmd", "/c", "ping", "-n", "30", "127.0.0.1"),
                workDir, null, Duration.ofSeconds(2));

        RunnerOutput output = runner.execute(command);

        assertTrue(output.timedOut());
    }
}
