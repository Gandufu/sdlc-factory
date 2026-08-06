package dev.sdlc.factory.persistence.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

/**
 * 能力单元实体（capability_unit 表）。
 *
 * <p>CU 是用户可理解的最小业务交付单元；
 * deliveryStatus 只是交付投影，生命周期真相在 LifecycleStage。</p>
 */
@TableName("capability_unit")
public class CapabilityUnitEntity {

    /** 能力单元 ID（CU- 前缀）。 */
    @TableId(type = IdType.INPUT)
    private String cuId;

    /** 所属项目 ID。 */
    private String projectId;

    /** CU 名称。 */
    private String name;

    /** 交付状态：PLANNED/CODING/TESTING/DELIVERED/ON_HOLD。 */
    private String deliveryStatus;

    public String getCuId() {
        return cuId;
    }

    public void setCuId(String cuId) {
        this.cuId = cuId;
    }

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

    public String getDeliveryStatus() {
        return deliveryStatus;
    }

    public void setDeliveryStatus(String deliveryStatus) {
        this.deliveryStatus = deliveryStatus;
    }
}
