package dev.sdlc.factory.contracts.context;

import java.util.Objects;

/**
 * 上下文清单条目（context-manifest.schema.json: entries 元素）。
 *
 * @param order             装配顺序（0 起）
 * @param sourceClass       来源类别
 * @param authorityClass    权威等级
 * @param sourceRef         来源引用
 * @param sourceVersion     来源版本
 * @param contentHash       内容哈希
 * @param estimatedTokens   估算 Token
 * @param redacted          是否执行过脱敏
 * @param loadReason        加载原因（固定来源 / 获批扩展请求）
 * @param expansionRequestId 关联的上下文扩展请求（可选）
 */
public record ContextEntry(
        int order,
        SourceClass sourceClass,
        AuthorityClass authorityClass,
        String sourceRef,
        String sourceVersion,
        String contentHash,
        int estimatedTokens,
        boolean redacted,
        String loadReason,
        String expansionRequestId) {

    public ContextEntry {
        Objects.requireNonNull(sourceClass, "sourceClass 不能为空");
        Objects.requireNonNull(authorityClass, "authorityClass 不能为空");
        Objects.requireNonNull(sourceRef, "sourceRef 不能为空");
        Objects.requireNonNull(sourceVersion, "sourceVersion 不能为空");
        Objects.requireNonNull(contentHash, "contentHash 不能为空");
        Objects.requireNonNull(loadReason, "loadReason 不能为空");
        if (order < 0 || estimatedTokens < 0) {
            throw new dev.sdlc.factory.common.ContractViolationException("order/estimatedTokens 不能为负数");
        }
        if (!contentHash.matches("^sha256:[a-f0-9]{64}$")) {
            throw new dev.sdlc.factory.common.ContractViolationException("非法内容哈希：" + contentHash);
        }
    }
}
