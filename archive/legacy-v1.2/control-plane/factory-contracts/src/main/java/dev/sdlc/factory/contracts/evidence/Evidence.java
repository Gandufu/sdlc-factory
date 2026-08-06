package dev.sdlc.factory.contracts.evidence;

import java.time.Instant;
import java.util.Objects;

/**
 * 执行证据（evidence.schema.json）。
 *
 * <p>Evidence 是不可变的执行事实，与诊断日志严格分离；
 * 只有 Evidence 能作为 Gate 依据。内容以内容寻址方式存储，
 * storage_ref 指向证据存储中的位置。</p>
 *
 * @param evidenceId   EVD- 标识
 * @param runId        关联 Run
 * @param evidenceType 证据类型
 * @param mediaType    媒体类型，如 text/plain
 * @param storageRef   存储引用
 * @param contentHash  内容哈希 sha256:...
 * @param byteLength   字节长度
 * @param source       产生来源
 * @param sanitized    脱敏标志，恒为 true
 * @param producedAt   产生时间
 */
public record Evidence(
        String evidenceId,
        String runId,
        EvidenceType evidenceType,
        String mediaType,
        String storageRef,
        String contentHash,
        long byteLength,
        EvidenceSource source,
        boolean sanitized,
        Instant producedAt) {

    public Evidence {
        Objects.requireNonNull(evidenceId, "evidenceId 不能为空");
        Objects.requireNonNull(runId, "runId 不能为空");
        Objects.requireNonNull(evidenceType, "evidenceType 不能为空");
        Objects.requireNonNull(mediaType, "mediaType 不能为空");
        Objects.requireNonNull(storageRef, "storageRef 不能为空");
        Objects.requireNonNull(contentHash, "contentHash 不能为空");
        Objects.requireNonNull(source, "source 不能为空");
        Objects.requireNonNull(producedAt, "producedAt 不能为空");
        if (byteLength < 0) {
            throw new dev.sdlc.factory.common.ContractViolationException("byte_length 不能为负数");
        }
        if (!contentHash.matches("^sha256:[a-f0-9]{64}$")) {
            throw new dev.sdlc.factory.common.ContractViolationException("非法内容哈希：" + contentHash);
        }
        if (!sanitized) {
            throw new dev.sdlc.factory.common.ContractViolationException("Evidence 必须已脱敏（sanitized=true）");
        }
    }
}
