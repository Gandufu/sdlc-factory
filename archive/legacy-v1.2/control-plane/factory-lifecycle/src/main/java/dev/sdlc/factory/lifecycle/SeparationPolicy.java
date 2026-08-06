package dev.sdlc.factory.lifecycle;

/**
 * 职责分离策略（review_record.separation_policy）。
 *
 * <p>默认 ENFORCED：同一作用域阶段内主要执行人不能同时担任审核人；
 * SINGLE_OPERATOR_EXCEPTION 仅本机单用户项目显式启用，且必须记录理由。</p>
 */
public enum SeparationPolicy {
    ENFORCED,
    SINGLE_OPERATOR_EXCEPTION
}
