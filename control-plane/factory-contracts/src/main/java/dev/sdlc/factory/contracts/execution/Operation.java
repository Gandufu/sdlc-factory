package dev.sdlc.factory.contracts.execution;

/** 项目操作类型（execution-result.schema.json: operation）。 */
public enum Operation {
    INSTANTIATE,
    COMPILE,
    BUILD,
    PACKAGE,
    TEST,
    START,
    READINESS,
    STOP,
    CLEAN
}
