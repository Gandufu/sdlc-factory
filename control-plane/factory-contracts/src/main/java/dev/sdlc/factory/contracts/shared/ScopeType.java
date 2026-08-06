package dev.sdlc.factory.contracts.shared;

/**
 * 作用域类型（机器合同字段 scope_type）。
 *
 * <p>Requirement/Design/SystemAcceptance 作用于 PROJECT，
 * Coding/Testing 作用于 CAPABILITY_UNIT（v1.2 §4.1）。</p>
 */
public enum ScopeType {
    PROJECT,
    CAPABILITY_UNIT
}
