package dev.sdlc.factory.lifecycle;

import dev.sdlc.factory.common.ContractViolationException;
import dev.sdlc.factory.contracts.shared.ScopeType;
import dev.sdlc.factory.contracts.shared.StageType;

import java.util.Objects;

/**
 * 阶段作用域（v1.2 不变量 7）。
 *
 * <p>LifecycleStage 必须携带 scope_type 与 scope_id；合法组合只有五种：
 * PROJECT+REQUIREMENT、PROJECT+DESIGN、CAPABILITY_UNIT+CODING、
 * CAPABILITY_UNIT+TESTING、PROJECT+SYSTEM_ACCEPTANCE。
 * 禁止为 CU 创建 Requirement/Design 阶段，也禁止项目级 Testing 替代 CU 测试审核。</p>
 *
 * @param scopeType 作用域类型
 * @param scopeId   作用域 ID
 * @param stageType 阶段类型
 */
public record StageScope(ScopeType scopeType, String scopeId, StageType stageType) {

    public StageScope {
        Objects.requireNonNull(scopeType, "scopeType 不能为空");
        Objects.requireNonNull(scopeId, "scopeId 不能为空");
        Objects.requireNonNull(stageType, "stageType 不能为空");
        if (scopeId.isBlank()) {
            throw new ContractViolationException("scopeId 不能为空串");
        }
        if (!isLegalCombination(scopeType, stageType)) {
            throw new ContractViolationException(
                    "非法作用域组合：%s + %s".formatted(scopeType, stageType));
        }
    }

    /**
     * 校验作用域与阶段组合是否合法（与 DDL chk_review_stage_scope 保持同一语义）。
     */
    public static boolean isLegalCombination(ScopeType scopeType, StageType stageType) {
        return switch (stageType) {
            // 项目级阶段
            case REQUIREMENT, DESIGN, SYSTEM_ACCEPTANCE -> scopeType == ScopeType.PROJECT;
            // CU 级阶段
            case CODING, TESTING -> scopeType == ScopeType.CAPABILITY_UNIT;
            // INITIALIZATION 拥有独立状态机，不进入统一 LifecycleStage
            case INITIALIZATION -> false;
        };
    }
}
