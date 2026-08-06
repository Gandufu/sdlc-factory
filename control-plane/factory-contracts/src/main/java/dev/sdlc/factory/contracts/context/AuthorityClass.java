package dev.sdlc.factory.contracts.context;

/**
 * 上下文权威等级（context-manifest.schema.json: authority_class）。
 *
 * <p>APPROVED_BASELINE 内容可进入权威上下文；REFERENCE 只作带来源的参考；
 * EXECUTION_CAPABILITY 只描述可调用能力。检索、记忆等动态结果不能覆盖正式基线。</p>
 */
public enum AuthorityClass {
    APPROVED_BASELINE,
    REFERENCE,
    EXECUTION_CAPABILITY
}
