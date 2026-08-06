package dev.sdlc.factory.contracts.invocation;

import java.util.Objects;

/**
 * 结构化输出合同（agent-invocation.schema.json: output_contract）。
 *
 * <p>宿主返回的结构化对象必须再次通过本地 Schema 校验；
 * validationRetryLimit 上限为 2。</p>
 *
 * @param schemaId             输出 Schema 标识
 * @param schemaVersion        Schema 版本
 * @param contentHash          Schema 内容哈希
 * @param validationRetryLimit 校验重试上限（0-2）
 */
public record OutputContract(
        String schemaId, String schemaVersion, String contentHash, int validationRetryLimit) {

    public OutputContract {
        Objects.requireNonNull(schemaId, "schemaId 不能为空");
        Objects.requireNonNull(schemaVersion, "schemaVersion 不能为空");
        Objects.requireNonNull(contentHash, "contentHash 不能为空");
        if (validationRetryLimit < 0 || validationRetryLimit > 2) {
            throw new dev.sdlc.factory.common.ContractViolationException("validationRetryLimit 必须在 0-2 之间");
        }
    }
}
