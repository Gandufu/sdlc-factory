package dev.sdlc.factory.contracts.handoff;

import dev.sdlc.factory.contracts.shared.TestOutcome;

import java.util.List;
import java.util.Objects;

/**
 * 交接单内的单项验证声明（handoff.schema.json: validations 元素）。
 *
 * @param name         验证名称
 * @param outcome      结果四态
 * @param evidenceRefs 支撑证据 ID 列表
 */
public record HandoffValidation(String name, TestOutcome outcome, List<String> evidenceRefs) {

    public HandoffValidation {
        Objects.requireNonNull(name, "name 不能为空");
        Objects.requireNonNull(outcome, "outcome 不能为空");
        evidenceRefs = evidenceRefs == null ? List.of() : List.copyOf(evidenceRefs);
    }
}
