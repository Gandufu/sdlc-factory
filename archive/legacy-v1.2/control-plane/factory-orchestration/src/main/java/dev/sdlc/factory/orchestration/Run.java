package dev.sdlc.factory.orchestration;

import dev.sdlc.factory.contracts.run.RunStage;

import java.time.Instant;
import java.util.Objects;

/**
 * 运行（Run）领域对象。
 *
 * <p>Run 是执行切片或项目操作的一次实际执行；
 * v1.2 同一 Factory 实例任一时刻只允许一个活动业务 Run。</p>
 *
 * @param runId     RUN- 标识
 * @param projectId PRJ- 标识
 * @param cuId      能力单元（项目级阶段为空）
 * @param stage     阶段
 * @param state     当前状态
 * @param createdAt 创建时间
 */
public record Run(
        String runId,
        String projectId,
        String cuId,
        RunStage stage,
        RunState state,
        Instant createdAt) {

    public Run {
        Objects.requireNonNull(runId, "runId 不能为空");
        Objects.requireNonNull(projectId, "projectId 不能为空");
        Objects.requireNonNull(stage, "stage 不能为空");
        Objects.requireNonNull(state, "state 不能为空");
        Objects.requireNonNull(createdAt, "createdAt 不能为空");
    }

    /** 返回携带新状态的副本（Run 不可变，状态变更产生新实例）。 */
    public Run withState(RunState newState) {
        return new Run(runId, projectId, cuId, stage, newState, createdAt);
    }

    /** 是否占用活动执行权。 */
    public boolean occupiesCapacity() {
        return state == RunState.RUNNING;
    }
}
