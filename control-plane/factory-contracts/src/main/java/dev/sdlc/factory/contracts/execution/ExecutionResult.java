package dev.sdlc.factory.contracts.execution;

import dev.sdlc.factory.contracts.shared.OperationStatus;
import dev.sdlc.factory.contracts.shared.TestOutcome;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/**
 * 执行结果（execution-result.schema.json）。
 *
 * <p>合同条件约束在紧凑构造器中强制：
 * TEST 操作必须携带 testOutcome；START 成功必须携带 runtimeLeaseRef；
 * FAILED/TIMED_OUT/BLOCKED 必须携带 errorRef。</p>
 *
 * @param executionId     EXE- 标识
 * @param runId           关联 Run
 * @param operation       操作类型
 * @param operationStatus 操作状态
 * @param testOutcome     测试结果（仅 TEST）
 * @param exitCode        进程退出码（可空）
 * @param baseRevision    基线 Git 修订
 * @param workingRevision 工作 Git 修订（可空）
 * @param runtimeLeaseRef 运行租约引用（START 成功必填）
 * @param errorRef        错误信封引用（失败态必填）
 * @param startedAt       开始时间
 * @param completedAt     结束时间
 * @param evidenceRefs    证据引用（至少一个）
 */
public record ExecutionResult(
        String executionId,
        String runId,
        Operation operation,
        OperationStatus operationStatus,
        TestOutcome testOutcome,
        Integer exitCode,
        String baseRevision,
        String workingRevision,
        String runtimeLeaseRef,
        String errorRef,
        Instant startedAt,
        Instant completedAt,
        List<String> evidenceRefs) {

    public ExecutionResult {
        Objects.requireNonNull(executionId, "executionId 不能为空");
        Objects.requireNonNull(runId, "runId 不能为空");
        Objects.requireNonNull(operation, "operation 不能为空");
        Objects.requireNonNull(operationStatus, "operationStatus 不能为空");
        Objects.requireNonNull(startedAt, "startedAt 不能为空");
        Objects.requireNonNull(completedAt, "completedAt 不能为空");
        evidenceRefs = evidenceRefs == null ? List.of() : List.copyOf(evidenceRefs);
        if (evidenceRefs.isEmpty()) {
            throw new dev.sdlc.factory.common.ContractViolationException("执行结果必须至少引用一个证据");
        }
        if (operation == Operation.TEST && testOutcome == null) {
            throw new dev.sdlc.factory.common.ContractViolationException("TEST 操作必须携带 test_outcome");
        }
        if (operation == Operation.START && operationStatus == OperationStatus.SUCCEEDED
                && (runtimeLeaseRef == null || runtimeLeaseRef.isBlank())) {
            throw new dev.sdlc.factory.common.ContractViolationException("START 成功必须携带 runtime_lease_ref");
        }
        boolean failure = operationStatus == OperationStatus.FAILED
                || operationStatus == OperationStatus.TIMED_OUT
                || operationStatus == OperationStatus.BLOCKED;
        if (failure && (errorRef == null || errorRef.isBlank())) {
            throw new dev.sdlc.factory.common.ContractViolationException("失败态执行结果必须携带 error_ref");
        }
    }
}
