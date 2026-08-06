package dev.sdlc.factory.contracts.error;

/** 错误分类（error-envelope.schema.json: category）。 */
public enum ErrorCategory {
    VALIDATION,
    AUTHENTICATION,
    PERMISSION,
    RATE_LIMIT,
    TIMEOUT,
    CANCELLED,
    CONFLICT,
    UNAVAILABLE,
    STRUCTURED_OUTPUT,
    INTERNAL
}
