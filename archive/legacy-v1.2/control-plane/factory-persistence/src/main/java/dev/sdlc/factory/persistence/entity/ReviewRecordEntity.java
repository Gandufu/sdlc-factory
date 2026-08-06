package dev.sdlc.factory.persistence.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.OffsetDateTime;

/**
 * 审核记录实体（review_record 表）。
 *
 * <p>职责分离与豁免校验由数据库 CHECK 约束兜底，
 * 领域层 ReviewRecord 在构造时做同一语义的应用层校验。</p>
 */
@TableName("review_record")
public class ReviewRecordEntity {

    /** 审核 ID。 */
    @TableId(type = IdType.INPUT)
    private String reviewId;

    /** 作用域类型 PROJECT/CAPABILITY_UNIT。 */
    private String scopeType;

    /** 作用域 ID。 */
    private String scopeId;

    /** 阶段类型。 */
    private String stageType;

    /** 基线候选引用。 */
    private String baselineCandidateRef;

    /** 源码修订（可选）。 */
    private String sourceRevision;

    /** 审核人稳定身份。 */
    private String reviewerIdentity;

    /** 审核人角色。 */
    private String reviewerRole;

    /** 主要执行人（CU 级审核必填）。 */
    private String primaryExecutorId;

    /** 职责分离策略。 */
    private String separationPolicy;

    /** 豁免理由（仅豁免时必填）。 */
    private String exceptionReason;

    /** 审核决定。 */
    private String decision;

    /** 审核意见。 */
    private String comments;

    /** 审核时间。 */
    private OffsetDateTime reviewedAt;

    /** 幂等键（唯一约束）。 */
    private String idempotencyKey;

    public String getReviewId() {
        return reviewId;
    }

    public void setReviewId(String reviewId) {
        this.reviewId = reviewId;
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

    public String getStageType() {
        return stageType;
    }

    public void setStageType(String stageType) {
        this.stageType = stageType;
    }

    public String getBaselineCandidateRef() {
        return baselineCandidateRef;
    }

    public void setBaselineCandidateRef(String baselineCandidateRef) {
        this.baselineCandidateRef = baselineCandidateRef;
    }

    public String getSourceRevision() {
        return sourceRevision;
    }

    public void setSourceRevision(String sourceRevision) {
        this.sourceRevision = sourceRevision;
    }

    public String getReviewerIdentity() {
        return reviewerIdentity;
    }

    public void setReviewerIdentity(String reviewerIdentity) {
        this.reviewerIdentity = reviewerIdentity;
    }

    public String getReviewerRole() {
        return reviewerRole;
    }

    public void setReviewerRole(String reviewerRole) {
        this.reviewerRole = reviewerRole;
    }

    public String getPrimaryExecutorId() {
        return primaryExecutorId;
    }

    public void setPrimaryExecutorId(String primaryExecutorId) {
        this.primaryExecutorId = primaryExecutorId;
    }

    public String getSeparationPolicy() {
        return separationPolicy;
    }

    public void setSeparationPolicy(String separationPolicy) {
        this.separationPolicy = separationPolicy;
    }

    public String getExceptionReason() {
        return exceptionReason;
    }

    public void setExceptionReason(String exceptionReason) {
        this.exceptionReason = exceptionReason;
    }

    public String getDecision() {
        return decision;
    }

    public void setDecision(String decision) {
        this.decision = decision;
    }

    public String getComments() {
        return comments;
    }

    public void setComments(String comments) {
        this.comments = comments;
    }

    public OffsetDateTime getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(OffsetDateTime reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public void setIdempotencyKey(String idempotencyKey) {
        this.idempotencyKey = idempotencyKey;
    }
}
