package dev.sdlc.factory.app.web.dto;

/**
 * 生命周期迁移请求（REST 入参）。
 *
 * @param state   当前状态名，如 DRAFT、RUNNING
 * @param command 命令名，如 START_SLICE、APPROVE
 * @param reason  挂起/失败原因（仅 EXTERNAL_HOLD、EXECUTION_FAILURE 必填）
 */
public record TransitionRequest(String state, String command, String reason) {
}
