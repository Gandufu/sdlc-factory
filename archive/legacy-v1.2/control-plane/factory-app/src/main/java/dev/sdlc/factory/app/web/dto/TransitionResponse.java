package dev.sdlc.factory.app.web.dto;

/**
 * 生命周期迁移响应（REST 出参）。
 *
 * @param previousState 迁移前状态名
 * @param newState      迁移后状态名
 */
public record TransitionResponse(String previousState, String newState) {
}
