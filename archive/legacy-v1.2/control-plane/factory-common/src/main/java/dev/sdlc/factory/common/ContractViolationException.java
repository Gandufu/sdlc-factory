package dev.sdlc.factory.common;

/**
 * 合同违背异常。
 *
 * <p>机器合同（JSON Schema 投影、ID 规范、作用域组合、职责分离规则等）
 * 被违反时抛出。对应 ErrorEnvelope 中的 VALIDATION 分类。</p>
 */
public final class ContractViolationException extends RuntimeException implements FactoryException {

    public ContractViolationException(String message) {
        super(message);
    }
}
