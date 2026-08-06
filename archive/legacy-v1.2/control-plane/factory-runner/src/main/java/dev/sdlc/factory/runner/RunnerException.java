package dev.sdlc.factory.runner;

/** 执行器基础设施异常（进程无法启动、IO 失败等）。 */
public final class RunnerException extends RuntimeException {

    public RunnerException(String message, Throwable cause) {
        super(message, cause);
    }
}
