package dev.sdlc.factory.contracts.invocation;

import java.util.Objects;

/**
 * 内容引用（agent-invocation.schema.json: $defs/contentRef）。
 *
 * @param ref         存储引用
 * @param contentHash 内容哈希 sha256:...
 */
public record ContentRef(String ref, String contentHash) {

    public ContentRef {
        Objects.requireNonNull(ref, "ref 不能为空");
        Objects.requireNonNull(contentHash, "contentHash 不能为空");
        if (!contentHash.matches("^sha256:[a-f0-9]{64}$")) {
            throw new dev.sdlc.factory.common.ContractViolationException("非法内容哈希：" + contentHash);
        }
    }
}
