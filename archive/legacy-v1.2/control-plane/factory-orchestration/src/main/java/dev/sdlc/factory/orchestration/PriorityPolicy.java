package dev.sdlc.factory.orchestration;

/** 容量队列选择策略（factory-run-budget.schema.json: priority_policy）。 */
public enum PriorityPolicy {
    /** 先依赖拓扑，再同层业务优先级，最后 FIFO。 */
    DEPENDENCY_THEN_BUSINESS_PRIORITY_THEN_FIFO
}
