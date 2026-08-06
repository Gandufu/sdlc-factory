package dev.sdlc.factory.contracts.error;

/** 错误来源（error-envelope.schema.json: source）。 */
public enum ErrorSource {
    FACTORY,
    HOST_ADAPTER,
    HOST,
    RUNNER,
    TOOL,
    ENVIRONMENT
}
