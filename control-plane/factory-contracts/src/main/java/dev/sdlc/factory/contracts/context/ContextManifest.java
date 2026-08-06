package dev.sdlc.factory.contracts.context;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/**
 * 上下文清单（context-manifest.schema.json）。
 *
 * <p>Context Assembler 确定性装配的结果：固定来源、版本、Hash、预算和顺序；
 * 智能体不能自行扫描项目或决定权威资料。</p>
 *
 * @param manifestId          CTX- 标识
 * @param runId               关联 Run
 * @param attemptId           关联尝试 ATT-
 * @param entries             条目（至少一个）
 * @param totalEstimatedTokens 估算 Token 总量
 * @param assembledAt         装配时间
 * @param contentHash         清单整体内容哈希
 */
public record ContextManifest(
        String manifestId,
        String runId,
        String attemptId,
        List<ContextEntry> entries,
        int totalEstimatedTokens,
        Instant assembledAt,
        String contentHash) {

    public ContextManifest {
        Objects.requireNonNull(manifestId, "manifestId 不能为空");
        Objects.requireNonNull(runId, "runId 不能为空");
        Objects.requireNonNull(attemptId, "attemptId 不能为空");
        Objects.requireNonNull(assembledAt, "assembledAt 不能为空");
        Objects.requireNonNull(contentHash, "contentHash 不能为空");
        entries = entries == null ? List.of() : List.copyOf(entries);
        if (entries.isEmpty()) {
            throw new dev.sdlc.factory.common.ContractViolationException("上下文清单必须至少包含一个条目");
        }
        if (totalEstimatedTokens < 0) {
            throw new dev.sdlc.factory.common.ContractViolationException("totalEstimatedTokens 不能为负数");
        }
    }
}
