package dev.sdlc.factory.lifecycle;

import dev.sdlc.factory.common.ContractViolationException;
import dev.sdlc.factory.contracts.shared.ScopeType;
import dev.sdlc.factory.contracts.shared.StageType;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * v1.2 §4.1 作用域组合测试：只允许五种合法组合。
 */
class StageScopeTest {

    @Test
    void shouldAcceptLegalCombinations() {
        assertDoesNotThrow(() -> new StageScope(ScopeType.PROJECT, "PRJ-1", StageType.REQUIREMENT));
        assertDoesNotThrow(() -> new StageScope(ScopeType.PROJECT, "PRJ-1", StageType.DESIGN));
        assertDoesNotThrow(() -> new StageScope(ScopeType.PROJECT, "PRJ-1", StageType.SYSTEM_ACCEPTANCE));
        assertDoesNotThrow(() -> new StageScope(ScopeType.CAPABILITY_UNIT, "CU-1", StageType.CODING));
        assertDoesNotThrow(() -> new StageScope(ScopeType.CAPABILITY_UNIT, "CU-1", StageType.TESTING));
    }

    @Test
    void shouldRejectIllegalCombinations() {
        // 禁止为 CU 创建 Requirement/Design 阶段
        assertThrows(ContractViolationException.class,
                () -> new StageScope(ScopeType.CAPABILITY_UNIT, "CU-1", StageType.REQUIREMENT));
        assertThrows(ContractViolationException.class,
                () -> new StageScope(ScopeType.CAPABILITY_UNIT, "CU-1", StageType.DESIGN));
        // 禁止项目级 Testing 替代 CU 测试审核
        assertThrows(ContractViolationException.class,
                () -> new StageScope(ScopeType.PROJECT, "PRJ-1", StageType.TESTING));
        // INITIALIZATION 拥有独立状态机，不进入统一 LifecycleStage
        assertThrows(ContractViolationException.class,
                () -> new StageScope(ScopeType.PROJECT, "PRJ-1", StageType.INITIALIZATION));
    }
}
