package dev.sdlc.factory.common;

/**
 * 非法状态迁移异常。
 *
 * <p>生命周期状态机或 Run 状态机拒绝了当前状态不允许的命令时抛出。
 * v1.2 不变量：任何状态迁移必须由显式命令触发并经 Guard 校验，
 * 非法迁移必须显式失败，而不是静默忽略。</p>
 */
public final class IllegalStateTransitionException extends RuntimeException implements FactoryException {

    public IllegalStateTransitionException(String message) {
        super(message);
    }
}
