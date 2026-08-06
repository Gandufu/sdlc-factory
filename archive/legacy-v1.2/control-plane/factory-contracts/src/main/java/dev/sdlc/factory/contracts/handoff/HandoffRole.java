package dev.sdlc.factory.contracts.handoff;

/** 交接单提交角色（handoff.schema.json: role）。 */
public enum HandoffRole {
    REQUIREMENT,
    DESIGN,
    CODER,
    TESTER,
    REVIEWER_ASSISTANT,
    SCRUTINY_VALIDATOR,
    USER_TESTING_VALIDATOR
}
