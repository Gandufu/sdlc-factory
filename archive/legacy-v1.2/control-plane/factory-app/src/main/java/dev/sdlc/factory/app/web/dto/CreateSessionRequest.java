package dev.sdlc.factory.app.web.dto;

public record CreateSessionRequest(String parentSessionId, String agent, String title) {
}
