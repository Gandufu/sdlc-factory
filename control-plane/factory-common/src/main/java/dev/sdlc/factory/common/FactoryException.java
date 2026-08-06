package dev.sdlc.factory.common;

/**
 * 工厂领域异常体系的密封根（sealed root）。
 *
 * <p>使用 sealed interface 收敛全部领域异常，上层（REST 错误处理器、
 * 门禁服务）可以用穷尽的 switch 模式匹配对异常分类处理，
 * 编译器保证不会遗漏新增的异常类型。</p>
 *
 * <p>注意：容量等待（QUEUED_FOR_CAPACITY）不是错误，不通过异常表达。</p>
 */
public sealed interface FactoryException
        permits IllegalStateTransitionException, ContractViolationException {

    /** 面向操作人员的可读原因。 */
    String getMessage();
}
