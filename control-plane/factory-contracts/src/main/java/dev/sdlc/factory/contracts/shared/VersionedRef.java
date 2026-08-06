package dev.sdlc.factory.contracts.shared;

import java.util.Objects;

/**
 * 版本化引用（机器合同 $defs/versionedRef）。
 *
 * <p>所有生产资料与基线引用都必须固定 id + version + content_hash，
 * 禁止解析可变的 latest（v1.2 不变量 17）。</p>
 *
 * @param id          稳定 ID
 * @param version     语义化版本，如 1.0.0
 * @param contentHash 内容哈希规范形式 sha256:...
 */
public record VersionedRef(String id, String version, String contentHash) {

    private static final String VERSION_PATTERN = "^\\d+\\.\\d+\\.\\d+$";

    public VersionedRef {
        Objects.requireNonNull(id, "id 不能为空");
        Objects.requireNonNull(version, "version 不能为空");
        Objects.requireNonNull(contentHash, "contentHash 不能为空");
        if (id.isBlank()) {
            throw new dev.sdlc.factory.common.ContractViolationException("versionedRef.id 不能为空串");
        }
        if (!version.matches(VERSION_PATTERN)) {
            throw new dev.sdlc.factory.common.ContractViolationException("非法语义化版本：" + version);
        }
        if (!contentHash.matches("^sha256:[a-f0-9]{64}$")) {
            throw new dev.sdlc.factory.common.ContractViolationException("非法内容哈希：" + contentHash);
        }
    }
}
