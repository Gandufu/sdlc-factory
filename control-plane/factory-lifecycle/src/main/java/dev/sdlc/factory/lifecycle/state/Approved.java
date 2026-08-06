package dev.sdlc.factory.lifecycle.state;

/** 已批准态（终态）：绑定基线与证据，阶段生命周期结束。 */
public record Approved() implements LifecycleState {

    public static final Approved INSTANCE = new Approved();

    @Override
    public String name() {
        return "APPROVED";
    }
}
