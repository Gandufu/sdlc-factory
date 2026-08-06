package dev.sdlc.factory.app.web.dto;

public record DecideWorkspaceGateRequest(String reviewerIdentity, String comments, String idempotencyKey,
                                         int expectedVersion) {
}
