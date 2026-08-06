package dev.sdlc.factory.lifecycle.state;

/** 退回修改态：操作人员拒绝了审核候选，等待发起新 Run。 */
public record ChangesRequested() implements LifecycleState {

    public static final ChangesRequested INSTANCE = new ChangesRequested();

    @Override
    public String name() {
        return "CHANGES_REQUESTED";
    }
}
