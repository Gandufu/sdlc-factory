package dev.sdlc.factory.contracts.shared;

/**
 * 测试结果四态（机器合同字段 test_outcome）。
 *
 * <p>v1.2 不变量 11：必测项只有 PASSED 可以通过；
 * SKIPPED 与 BLOCKED 都不能假绿。</p>
 */
public enum TestOutcome {
    PASSED,
    FAILED,
    SKIPPED,
    BLOCKED
}
