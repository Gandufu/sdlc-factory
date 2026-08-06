package dev.sdlc.factory.app.host;

/** OpenCode Run 已持久化为失败，但调用方仍需要保留其 Run 边界。 */
public final class HostExecutionException extends RuntimeException {

    private final String runId;

    public HostExecutionException(String runId, RuntimeException cause) {
        super(cause.getMessage(), cause);
        this.runId = runId;
    }

    public String runId() {
        return runId;
    }
}
