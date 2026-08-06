package dev.sdlc.factory.lifecycle;

import java.util.Objects;

/**
 * 基线条目（baseline_item：产物引用 + 内容哈希）。
 *
 * @param artifactType 产物类型，如 SRS、DESIGN_DOC、CODE_DIFF、TEST_REPORT
 * @param artifactRef  产物存储引用
 * @param contentHash  内容哈希 sha256:...
 */
public record ArtifactRef(String artifactType, String artifactRef, String contentHash) {

    public ArtifactRef {
        Objects.requireNonNull(artifactType, "artifactType 不能为空");
        Objects.requireNonNull(artifactRef, "artifactRef 不能为空");
        Objects.requireNonNull(contentHash, "contentHash 不能为空");
        if (!contentHash.matches("^sha256:[a-f0-9]{64}$")) {
            throw new dev.sdlc.factory.common.ContractViolationException("非法内容哈希：" + contentHash);
        }
    }
}
