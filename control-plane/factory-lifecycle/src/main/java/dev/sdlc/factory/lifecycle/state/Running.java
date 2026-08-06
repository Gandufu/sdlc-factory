package dev.sdlc.factory.lifecycle.state;

/** 运行态：执行切片正在串行执行。 */
public record Running() implements LifecycleState {

    public static final Running INSTANCE = new Running();

    @Override
    public String name() {
        return "RUNNING";
    }
}
