package dev.sdlc.factory.lifecycle.state;

/** 草稿态：阶段刚创建，尚未启动任何执行切片。 */
public record Draft() implements LifecycleState {

    /** 单例：无参数状态共享同一实例，减少对象分配。 */
    public static final Draft INSTANCE = new Draft();

    @Override
    public String name() {
        return "DRAFT";
    }
}
