package dev.sdlc.factory.lifecycle;

/**
 * 基线有效性（baseline.validity_status）。
 *
 * <p>上游基线变化时下游历史保留，有效性变为 STALE 或 IMPACT_REVIEW_REQUIRED；
 * 已批准基线永不原地修改。</p>
 */
public enum ValidityStatus {
    VALID,
    STALE,
    IMPACT_REVIEW_REQUIRED
}
