package dev.sdlc.factory.persistence.projection;

import java.time.OffsetDateTime;

/**
 * Run 详情投影（复杂多表查询的结果载体，见 RunDetailQueryMapper.xml）。
 *
 * <p>使用 record 保证投影只读；列与构造参数通过 XML 的
 * {@code <constructor>} 显式绑定，不依赖字段自动映射。</p>
 *
 * @param runId          Run ID
 * @param runStatus      Run 状态
 * @param projectId      项目 ID
 * @param projectName    项目名称
 * @param cuId           能力单元 ID（可空）
 * @param cuName         能力单元名称（可空）
 * @param deliveryStatus CU 交付状态（可空）
 * @param createdAt      Run 创建时间
 */
public record RunDetailProjection(
        String runId,
        String runStatus,
        String projectId,
        String projectName,
        String cuId,
        String cuName,
        String deliveryStatus,
        OffsetDateTime createdAt) {
}
