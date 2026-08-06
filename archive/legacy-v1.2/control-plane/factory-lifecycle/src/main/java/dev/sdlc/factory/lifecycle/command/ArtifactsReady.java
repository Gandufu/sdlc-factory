package dev.sdlc.factory.lifecycle.command;

/** 产物就绪：Running → AwaitingReview，须已通过权威确定性检查。 */
public record ArtifactsReady() implements LifecycleCommand {

    public static final ArtifactsReady INSTANCE = new ArtifactsReady();
}
