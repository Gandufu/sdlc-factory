package dev.sdlc.factory.lifecycle.command;

/** 操作人员退回：AwaitingReview → ChangesRequested。 */
public record Reject() implements LifecycleCommand {

    public static final Reject INSTANCE = new Reject();
}
