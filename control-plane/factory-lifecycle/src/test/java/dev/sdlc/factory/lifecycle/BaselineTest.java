package dev.sdlc.factory.lifecycle;

import dev.sdlc.factory.common.ContractViolationException;
import dev.sdlc.factory.contracts.shared.ScopeType;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * v1.2 §6.1 基线测试：类型-作用域约束与失效传播。
 */
class BaselineTest {

    private static final String HASH = "sha256:" + "b".repeat(64);

    private Baseline baseline(BaselineType type, ScopeType scope) {
        return new Baseline("BL-001", scope, "SCOPE-1", type, 1, HASH, "rev-1",
                List.of(new ArtifactRef("TEST_REPORT", "evidence://r1", HASH)),
                "REV-001", null, ValidityStatus.VALID, Instant.now());
    }

    @Test
    void shouldEnforceTypeScopeCombinations() {
        // CODE 基线必须作用于 CU
        assertThrows(ContractViolationException.class,
                () -> baseline(BaselineType.CODE, ScopeType.PROJECT));
        // DESIGN 基线必须作用于项目
        assertThrows(ContractViolationException.class,
                () -> baseline(BaselineType.DESIGN, ScopeType.CAPABILITY_UNIT));
    }

    @Test
    void shouldInvalidateWithoutMutatingOriginal() {
        Baseline valid = baseline(BaselineType.TEST, ScopeType.CAPABILITY_UNIT);
        Baseline stale = valid.invalidate(ValidityStatus.STALE);

        // 原实例保持 VALID（不可变），新实例携带 STALE
        assertEquals(ValidityStatus.VALID, valid.validityStatus());
        assertEquals(ValidityStatus.STALE, stale.validityStatus());
        // 不允许通过 invalidate 恢复 VALID
        assertThrows(ContractViolationException.class,
                () -> stale.invalidate(ValidityStatus.VALID));
    }
}
