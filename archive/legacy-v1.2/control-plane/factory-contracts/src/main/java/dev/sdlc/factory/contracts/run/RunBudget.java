package dev.sdlc.factory.contracts.run;

/**
 * 运行预算（run-request.schema.json: budget）。
 *
 * <p>v1.2 用预算约束智能体长推理与重复调用；
 * maxValidationRounds 用于独立验证循环的轮次熔断。</p>
 *
 * @param maxDurationMs      单次运行最大时长（毫秒）
 * @param maxHostCalls       宿主调用次数上限
 * @param maxOutputTokens    输出 Token 上限
 * @param maxCostUsd         成本上限（美元）
 * @param maxValidationRounds 验证轮次上限（可选）
 */
public record RunBudget(
        long maxDurationMs,
        int maxHostCalls,
        long maxOutputTokens,
        double maxCostUsd,
        Integer maxValidationRounds) {

    public RunBudget {
        if (maxDurationMs < 1 || maxHostCalls < 1 || maxOutputTokens < 1 || maxCostUsd < 0) {
            throw new dev.sdlc.factory.common.ContractViolationException("运行预算字段必须为正数");
        }
        if (maxValidationRounds != null && maxValidationRounds < 1) {
            throw new dev.sdlc.factory.common.ContractViolationException("maxValidationRounds 必须 >= 1");
        }
    }
}
