package dev.sdlc.factory.persistence.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.OffsetDateTime;

/**
 * 基线实体（baseline 表）。
 *
 * <p>基线条目存放在 baseline_item 子表；
 * 本实体只承载基线头部事实。</p>
 */
@TableName("baseline")
public class BaselineEntity {

    /** 基线 ID。 */
    @TableId(type = IdType.INPUT)
    private String baselineId;

    /** 作用域类型。 */
    private String scopeType;

    /** 作用域 ID。 */
    private String scopeId;

    /** 基线类型。 */
    private String baselineType;

    /** 产物版本（>0）。 */
    private Integer artifactVersion;

    /** 基线整体内容哈希。 */
    private String contentHash;

    /** 源码修订（可选）。 */
    private String sourceRevision;

    /** 批准的审核记录 ID。 */
    private String reviewRecordId;

    /** 签名/存证引用（预留，可选）。 */
    private String signatureRef;

    /** 有效性 VALID/STALE/IMPACT_REVIEW_REQUIRED。 */
    private String validityStatus;

    /** 创建时间。 */
    private OffsetDateTime createdAt;

    public String getBaselineId() {
        return baselineId;
    }

    public void setBaselineId(String baselineId) {
        this.baselineId = baselineId;
    }

    public String getScopeType() {
        return scopeType;
    }

    public void setScopeType(String scopeType) {
        this.scopeType = scopeType;
    }

    public String getScopeId() {
        return scopeId;
    }

    public void setScopeId(String scopeId) {
        this.scopeId = scopeId;
    }

    public String getBaselineType() {
        return baselineType;
    }

    public void setBaselineType(String baselineType) {
        this.baselineType = baselineType;
    }

    public Integer getArtifactVersion() {
        return artifactVersion;
    }

    public void setArtifactVersion(Integer artifactVersion) {
        this.artifactVersion = artifactVersion;
    }

    public String getContentHash() {
        return contentHash;
    }

    public void setContentHash(String contentHash) {
        this.contentHash = contentHash;
    }

    public String getSourceRevision() {
        return sourceRevision;
    }

    public void setSourceRevision(String sourceRevision) {
        this.sourceRevision = sourceRevision;
    }

    public String getReviewRecordId() {
        return reviewRecordId;
    }

    public void setReviewRecordId(String reviewRecordId) {
        this.reviewRecordId = reviewRecordId;
    }

    public String getSignatureRef() {
        return signatureRef;
    }

    public void setSignatureRef(String signatureRef) {
        this.signatureRef = signatureRef;
    }

    public String getValidityStatus() {
        return validityStatus;
    }

    public void setValidityStatus(String validityStatus) {
        this.validityStatus = validityStatus;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
