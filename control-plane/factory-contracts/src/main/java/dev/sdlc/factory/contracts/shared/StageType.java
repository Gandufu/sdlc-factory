package dev.sdlc.factory.contracts.shared;

/**
 * 阶段类型（机器合同字段 stage_type）。
 *
 * <p>INITIALIZATION 只出现在门禁命令中（初始化有独立状态机），
 * 其余五种参与统一的 LifecycleStage 状态机。</p>
 */
public enum StageType {
    INITIALIZATION,
    REQUIREMENT,
    DESIGN,
    CODING,
    TESTING,
    SYSTEM_ACCEPTANCE
}
