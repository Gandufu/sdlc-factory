package dev.sdlc.factory.lifecycle.command;

/** 启动执行切片：Draft / ChangesRequested / OnHold / NeedsIntervention → Running。 */
public record StartSlice() implements LifecycleCommand {

    public static final StartSlice INSTANCE = new StartSlice();
}
