package dev.sdlc.factory.contracts.evidence;

import java.util.Objects;

/**
 * 证据来源（evidence.schema.json: source）。
 *
 * @param kind          产生者类别
 * @param sourceId      产生者标识（如 Run ID、Operator ID）
 * @param commandDigest 命令摘要哈希（可选）
 */
public record EvidenceSource(EvidenceSourceKind kind, String sourceId, String commandDigest) {

    public EvidenceSource {
        Objects.requireNonNull(kind, "kind 不能为空");
        Objects.requireNonNull(sourceId, "sourceId 不能为空");
        if (sourceId.isBlank()) {
            throw new dev.sdlc.factory.common.ContractViolationException("evidence.source.source_id 不能为空串");
        }
    }
}
