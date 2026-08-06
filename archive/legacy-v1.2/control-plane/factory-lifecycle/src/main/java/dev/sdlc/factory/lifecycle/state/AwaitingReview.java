package dev.sdlc.factory.lifecycle.state;

/** 待审核态：产物与证据齐备，等待操作人员门禁裁决。 */
public record AwaitingReview() implements LifecycleState {

    public static final AwaitingReview INSTANCE = new AwaitingReview();

    @Override
    public String name() {
        return "AWAITING_REVIEW";
    }
}
