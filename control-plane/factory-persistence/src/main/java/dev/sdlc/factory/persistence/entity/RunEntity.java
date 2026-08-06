package dev.sdlc.factory.persistence.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.OffsetDateTime;

/**
 * 运行实体（run 表）。
 *
 * <p>status 取值受数据库 CHECK 约束限定，
 * 与领域层 RunState 枚举一一对应。</p>
 */
@TableName("run")
public class RunEntity {

    /** Run ID（RUN- 前缀）。 */
    @TableId(type = IdType.INPUT)
    private String runId;

    /** 所属项目 ID。 */
    private String projectId;

    /** 能力单元 ID（项目级阶段为空）。 */
    private String cuId;

    /** 尝试 ID（ATT- 前缀）。 */
    private String attemptId;

    /** Run 状态（DDL CHECK 约束）。 */
    private String status;

    /** 创建时间。 */
    private OffsetDateTime createdAt;

    public String getRunId() {
        return runId;
    }

    public void setRunId(String runId) {
        this.runId = runId;
    }

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public String getCuId() {
        return cuId;
    }

    public void setCuId(String cuId) {
        this.cuId = cuId;
    }

    public String getAttemptId() {
        return attemptId;
    }

    public void setAttemptId(String attemptId) {
        this.attemptId = attemptId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
