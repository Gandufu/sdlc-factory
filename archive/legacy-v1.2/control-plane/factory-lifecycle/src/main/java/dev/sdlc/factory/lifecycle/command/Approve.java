package dev.sdlc.factory.lifecycle.command;

/** 操作人员批准：AwaitingReview → Approved（绑定 ReviewRecord 与 Baseline）。 */
public record Approve() implements LifecycleCommand {

    public static final Approve INSTANCE = new Approve();
}
