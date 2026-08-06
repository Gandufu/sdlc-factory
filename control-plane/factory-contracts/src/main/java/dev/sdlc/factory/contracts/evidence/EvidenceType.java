package dev.sdlc.factory.contracts.evidence;

/** 证据类型（evidence.schema.json: evidence_type）。 */
public enum EvidenceType {
    COMMAND_OUTPUT,
    TEST_RESULT,
    DIFF,
    FILE,
    SCREENSHOT,
    TRACE,
    REPORT
}
