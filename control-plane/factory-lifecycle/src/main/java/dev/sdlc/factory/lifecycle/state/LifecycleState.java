package dev.sdlc.factory.lifecycle.state;

/**
 * 生命周期阶段状态（v1.2 §4.3 状态机）。
 *
 * <p>使用 sealed interface 密封全部合法状态：
 * 状态机的 switch 模式匹配因此获得编译期穷尽性检查，
 * 新增状态时所有未覆盖的迁移点都会编译失败——这正是
 * “非法迁移必须显式失败”不变量在类型层面的落点。</p>
 */
public sealed interface LifecycleState
        permits Draft, Running, AwaitingReview, OnHold,
                NeedsIntervention, ChangesRequested, Approved {

    /** 状态名称（与 UI/数据库枚举保持一致）。 */
    String name();
}
