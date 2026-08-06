package dev.sdlc.factory.contracts.host;

/**
 * 宿主用量（host-run-result.schema.json: usage）。
 *
 * <p>提供方未返回成本时由上层写 unavailable 标记，不能写成确定的零；
 * 本 record 只表达已确认收到的数值。</p>
 *
 * @param inputTokens  输入 Token
 * @param outputTokens 输出 Token
 * @param costUsd      成本（美元）
 * @param hostCalls    宿主调用次数
 */
public record HostUsage(long inputTokens, long outputTokens, double costUsd, int hostCalls) {

    public HostUsage {
        if (inputTokens < 0 || outputTokens < 0 || costUsd < 0 || hostCalls < 0) {
            throw new dev.sdlc.factory.common.ContractViolationException("用量字段不能为负数");
        }
    }
}
