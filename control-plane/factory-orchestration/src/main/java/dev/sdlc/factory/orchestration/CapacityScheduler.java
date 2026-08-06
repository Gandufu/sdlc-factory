package dev.sdlc.factory.orchestration;

import java.util.List;
import java.util.Objects;
import java.util.Queue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.ConcurrentMap;

/**
 * 容量调度器（v1.2 §2.1 Capacity Scheduler）。
 *
 * <p>职责：单实例与项目配额裁决、容量队列维护与释放。
 * 不变量：把等待容量记成失败、或隐式启用并行，都是合同违规。</p>
 *
 * <p>实现说明：当前为单实例内存实现（MVP-A 范围）；
 * 并发安全通过 ConcurrentHashMap + synchronized 裁决块保证。
 * 未来提高并发数时必须先引入工作目录隔离与锁合同。</p>
 */
public final class CapacityScheduler {

    /** 容量合同（首版固定串行）。 */
    private final FactoryRunBudget budget;

    /** 当前占用活动执行权的 Run（串行合同下至多一个）。 */
    private final ConcurrentMap<String, Run> activeRuns = new ConcurrentHashMap<>();

    /** 容量等待队列（FIFO 基础顺序，后续按优先级策略重排）。 */
    private final Queue<Run> waitingQueue = new ConcurrentLinkedQueue<>();

    public CapacityScheduler(FactoryRunBudget budget) {
        this.budget = Objects.requireNonNull(budget, "budget 不能为空");
    }

    /**
     * 为一个候选 Run 申请活动执行权。
     *
     * @param candidate 候选 Run（状态应为 QUEUED_FOR_CAPACITY 或初始态）
     * @return Admitted（立即执行）或 QueuedForCapacity（排队）
     */
    public synchronized CapacityDecision request(Run candidate) {
        Objects.requireNonNull(candidate, "candidate 不能为空");

        if (activeRuns.size() >= budget.maxConcurrentRuns()) {
            // 容量不足：正常排队，绝不记为失败
            waitingQueue.add(candidate.withState(RunState.QUEUED_FOR_CAPACITY));
            return new QueuedForCapacity(candidate.runId(), waitingQueue.size());
        }
        activeRuns.put(candidate.runId(), candidate.withState(RunState.RUNNING));
        return new Admitted(candidate.runId());
    }

    /**
     * 释放活动执行权（Run 结束、取消、挂起或超时后调用）。
     * 释放后队列首个等待者由调用方再次 request 提升，
     * 以保证提升动作与审计事件在同一决策点发生。
     *
     * @param runId 结束的 Run
     * @return 队列中下一个等待 Run（若存在）
     */
    public synchronized Run release(String runId) {
        activeRuns.remove(runId);
        return waitingQueue.poll();
    }

    /** 当前活动 Run 数量（观测用）。 */
    public int activeCount() {
        return activeRuns.size();
    }

    /** 当前等待队列快照（观测用，看板投影）。 */
    public List<Run> waitingSnapshot() {
        return List.copyOf(waitingQueue);
    }

    /** 容量合同（只读暴露，供 API 与测试使用）。 */
    public FactoryRunBudget budget() {
        return budget;
    }
}
