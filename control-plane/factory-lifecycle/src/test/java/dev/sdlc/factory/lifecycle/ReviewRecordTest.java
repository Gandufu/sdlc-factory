package dev.sdlc.factory.lifecycle;

import dev.sdlc.factory.common.ContractViolationException;
import dev.sdlc.factory.contracts.shared.ScopeType;
import dev.sdlc.factory.contracts.shared.StageType;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * v1.2 §10.4 审核记录测试：职责分离与单操作员豁免审计。
 */
class ReviewRecordTest {

    private static final Instant NOW = Instant.parse("2026-08-06T08:00:00Z");

    /** 构造一条基础审核记录（可覆盖关键字段）。 */
    private ReviewRecord record(String reviewer, String executor,
                                SeparationPolicy policy, String exceptionReason) {
        return new ReviewRecord(
                "REV-001",
                new StageScope(ScopeType.CAPABILITY_UNIT, "CU-1", StageType.CODING),
                "cand://baseline-1",
                null,
                "rev-abc",
                reviewer,
                ReviewerRole.REVIEWER,
                executor,
                policy,
                exceptionReason,
                ReviewDecision.APPROVED,
                "材料完整，予以批准",
                NOW,
                "idem-001");
    }

    @Test
    void shouldEnforceSeparationOfDuties() {
        // 同一人执行并审核：默认拦截
        assertThrows(ContractViolationException.class,
                () -> record("OP-1", "OP-1", SeparationPolicy.ENFORCED, null));
        // 不同人：通过
        assertDoesNotThrow(() -> record("OP-2", "OP-1", SeparationPolicy.ENFORCED, null));
    }

    @Test
    void shouldRequireAuditedExceptionForSingleOperator() {
        // 豁免缺少理由：拒绝
        assertThrows(ContractViolationException.class,
                () -> record("OP-1", "OP-1", SeparationPolicy.SINGLE_OPERATOR_EXCEPTION, "  "));
        // 显式豁免并记录理由：通过
        assertDoesNotThrow(() -> record("OP-1", "OP-1",
                SeparationPolicy.SINGLE_OPERATOR_EXCEPTION, "本机单用户项目，已确认风险"));
    }

    @Test
    void shouldRequirePrimaryExecutorForCuStages() {
        // CU 级 CODING 审核未声明主要执行人：拒绝
        assertThrows(ContractViolationException.class,
                () -> record("OP-1", null, SeparationPolicy.ENFORCED, null));
    }
}
