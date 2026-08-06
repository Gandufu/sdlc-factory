package dev.sdlc.factory.gate;

import dev.sdlc.factory.common.ContractViolationException;
import dev.sdlc.factory.contracts.gate.GateCommand;
import dev.sdlc.factory.lifecycle.StageScope;

import java.util.Objects;

/**
 * 门禁前置校验器。
 *
 * <p>在提交领域事务前执行确定性检查：
 * 作用域组合必须合法（v1.2 §4.1），命令字段必须符合合同。
 * 门禁结论只能来自确定性校验与人工裁决，不能从聊天文本猜测。</p>
 */
public final class GatePreconditionChecker {

    /**
     * 校验门禁命令；任何违规抛出 {@link ContractViolationException}。
     *
     * @param command 待校验命令
     */
    public void check(GateCommand command) {
        Objects.requireNonNull(command, "command 不能为空");

        // 作用域 + 阶段组合必须属于五种合法组合之一；
        // INITIALIZATION 走初始化独立状态机，不进入统一门禁作用域
        if (!StageScope.isLegalCombination(command.scopeType(), command.stageType())) {
            throw new ContractViolationException(
                    "门禁作用域组合非法：%s + %s".formatted(command.scopeType(), command.stageType()));
        }

        // 批准与退回都必须附带审核意见，保证审计材料完整
        if (command.comments() == null || command.comments().isBlank()) {
            throw new ContractViolationException("门禁命令必须携带审核意见 comments");
        }
    }
}
