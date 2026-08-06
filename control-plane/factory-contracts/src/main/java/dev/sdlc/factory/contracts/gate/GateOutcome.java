package dev.sdlc.factory.contracts.gate;

/** 门禁裁决结果（gate-result.schema.json: outcome）。 */
public enum GateOutcome {
    /** 事务已提交。 */
    APPLIED,
    /** 前置校验失败被拒绝。 */
    REJECTED,
    /** 幂等重放：相同 idempotencyKey 已处理过。 */
    IDEMPOTENT_REPLAY
}
