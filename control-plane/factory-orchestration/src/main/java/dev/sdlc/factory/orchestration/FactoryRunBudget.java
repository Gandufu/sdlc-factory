package dev.sdlc.factory.orchestration;

/**
 * 工厂容量合同（v1.2 §9.2）。
 *
 * <p>首版显式固定：max_concurrent_runs = 1，per_project_quota = 1。
 * 这不是并行开关，而是把“等待唯一活动执行权”提升为可观测、
 * 可恢复的正常队列状态。未来提高并发必须先引入工作目录隔离、
 * 锁与恢复合同并发布新架构基线。</p>
 *
 * @param maxConcurrentRuns 全局活动 Run 上限
 * @param perProjectQuota   单项目配额
 * @param priorityPolicy    队列选择策略
 */
public record FactoryRunBudget(int maxConcurrentRuns, int perProjectQuota, PriorityPolicy priorityPolicy) {

    /** v1.2 首版固定容量合同。 */
    public static FactoryRunBudget serialDefaults() {
        return new FactoryRunBudget(1, 1, PriorityPolicy.DEPENDENCY_THEN_BUSINESS_PRIORITY_THEN_FIFO);
    }

    public FactoryRunBudget {
        if (maxConcurrentRuns < 1 || perProjectQuota < 1) {
            throw new IllegalArgumentException("容量合同字段必须为正数");
        }
        if (priorityPolicy == null) {
            throw new IllegalArgumentException("priorityPolicy 不能为空");
        }
    }
}
