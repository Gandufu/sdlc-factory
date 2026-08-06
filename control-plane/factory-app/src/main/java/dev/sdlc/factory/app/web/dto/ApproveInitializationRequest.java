package dev.sdlc.factory.app.web.dto;

/** 初始化人工审核命令。 */
public record ApproveInitializationRequest(
        String reviewerIdentity,
        String comments,
        String idempotencyKey) {
}
