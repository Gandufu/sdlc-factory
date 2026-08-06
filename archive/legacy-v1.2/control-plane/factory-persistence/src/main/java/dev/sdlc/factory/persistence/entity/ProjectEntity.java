package dev.sdlc.factory.persistence.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.OffsetDateTime;

/**
 * 项目实体（project 表）。
 *
 * <p>ID 由工厂生成（IdType.INPUT），不依赖数据库自增；
 * singleOperatorExceptionEnabled 是单操作员豁免的项目级开关。</p>
 */
@TableName("project")
public class ProjectEntity {

    /** 项目 ID（PRJ- 前缀）。 */
    @TableId(type = IdType.INPUT)
    private String projectId;

    /** 项目名称。 */
    private String name;

    /** 是否显式启用单操作员豁免（v1.2 §10.4）。 */
    private Boolean singleOperatorExceptionEnabled;

    /** 创建时间。 */
    private OffsetDateTime createdAt;

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Boolean getSingleOperatorExceptionEnabled() {
        return singleOperatorExceptionEnabled;
    }

    public void setSingleOperatorExceptionEnabled(Boolean singleOperatorExceptionEnabled) {
        this.singleOperatorExceptionEnabled = singleOperatorExceptionEnabled;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
