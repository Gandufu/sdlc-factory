package dev.sdlc.factory.lifecycle.command;

/** 操作人员恢复挂起阶段：OnHold → Running。 */
public record Resume() implements LifecycleCommand {

    public static final Resume INSTANCE = new Resume();
}
