package dev.sdlc.factory.contracts.run;

import dev.sdlc.factory.contracts.shared.VersionedRef;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/**
 * 运行请求（run-request.schema.json）。
 *
 * <p>Orchestrator 创建 Run 时必须解析并固定全部生产资料引用（Agent/Prompt/Rule/Template），
 * Stage Agent Adapter 之后不得把可变别名重新解析为其他内容。</p>
 *
 * @param protocolVersion      合同协议版本，固定 1.0
 * @param runId                RUN- 标识
 * @param attemptId            ATT- 标识，同一 Run 的重试尝试
 * @param projectId            PRJ- 标识
 * @param csciIds              参与的 CSCI（可选）
 * @param cuId                 能力单元（项目级阶段为空）
 * @param stage                阶段
 * @param sliceId              执行切片（可选）
 * @param objective            本次运行目标
 * @param baselineRefs         依赖基线（INITIALIZATION 阶段必须为空，其余阶段至少一个）
 * @param referenceBindings    参考资料引用绑定
 * @param environmentBindingRef 环境绑定（可选）
 * @param agentDefinitionRef   智能体定义精确版本
 * @param promptTemplateRef    提示词模板精确版本
 * @param ruleSetRef           规则集精确版本
 * @param templateBindingRef   模板绑定（可选）
 * @param budget               运行预算
 * @param idempotencyKey       幂等键
 * @param requestedAt          请求时间
 */
public record RunRequest(
        String protocolVersion,
        String runId,
        String attemptId,
        String projectId,
        List<String> csciIds,
        String cuId,
        RunStage stage,
        String sliceId,
        String objective,
        List<VersionedRef> baselineRefs,
        List<VersionedRef> referenceBindings,
        VersionedRef environmentBindingRef,
        VersionedRef agentDefinitionRef,
        VersionedRef promptTemplateRef,
        VersionedRef ruleSetRef,
        VersionedRef templateBindingRef,
        RunBudget budget,
        String idempotencyKey,
        Instant requestedAt) {

    public RunRequest {
        Objects.requireNonNull(protocolVersion, "protocolVersion 不能为空");
        Objects.requireNonNull(runId, "runId 不能为空");
        Objects.requireNonNull(attemptId, "attemptId 不能为空");
        Objects.requireNonNull(projectId, "projectId 不能为空");
        Objects.requireNonNull(stage, "stage 不能为空");
        Objects.requireNonNull(objective, "objective 不能为空");
        Objects.requireNonNull(agentDefinitionRef, "agentDefinitionRef 不能为空");
        Objects.requireNonNull(promptTemplateRef, "promptTemplateRef 不能为空");
        Objects.requireNonNull(ruleSetRef, "ruleSetRef 不能为空");
        Objects.requireNonNull(budget, "budget 不能为空");
        Objects.requireNonNull(idempotencyKey, "idempotencyKey 不能为空");
        Objects.requireNonNull(requestedAt, "requestedAt 不能为空");
        if (!"1.0".equals(protocolVersion)) {
            throw new dev.sdlc.factory.common.ContractViolationException("protocol_version 必须为 1.0");
        }
        // 合同条件约束：INITIALIZATION 无基线引用，其余阶段至少一个
        baselineRefs = baselineRefs == null ? List.of() : List.copyOf(baselineRefs);
        boolean initialization = stage == RunStage.INITIALIZATION;
        if (initialization && !baselineRefs.isEmpty()) {
            throw new dev.sdlc.factory.common.ContractViolationException("INITIALIZATION 阶段不允许携带基线引用");
        }
        if (!initialization && baselineRefs.isEmpty()) {
            throw new dev.sdlc.factory.common.ContractViolationException("非 INITIALIZATION 阶段必须至少引用一个基线");
        }
        csciIds = csciIds == null ? List.of() : List.copyOf(csciIds);
        referenceBindings = referenceBindings == null ? List.of() : List.copyOf(referenceBindings);
    }
}
