package dev.sdlc.factory.app.web.dto;

/**
 * 容量申请请求（REST 入参）。
 *
 * @param runId     RUN- 标识
 * @param projectId PRJ- 标识
 * @param cuId      能力单元（项目级阶段可空）
 * @param stage     阶段名，如 CODING
 */
public record CapacityRequestPayload(String runId, String projectId, String cuId, String stage) {
}
