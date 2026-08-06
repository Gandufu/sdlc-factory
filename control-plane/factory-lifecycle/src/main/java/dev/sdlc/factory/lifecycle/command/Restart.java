package dev.sdlc.factory.lifecycle.command;

/** 操作人员重启失败阶段：NeedsIntervention → Running（创建新 Run）。 */
public record Restart() implements LifecycleCommand {

    public static final Restart INSTANCE = new Restart();
}
