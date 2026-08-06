package dev.sdlc.factory.orchestration;

import dev.sdlc.factory.contracts.run.RunStage;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

/**
 * v1.2 §9.2 容量合同测试：串行执行 + QUEUED_FOR_CAPACITY 显式等待。
 */
class CapacitySchedulerTest {

    private static Run run(String id) {
        return new Run(id, "PRJ-1", "CU-1", RunStage.CODING,
                RunState.QUEUED_FOR_CAPACITY, Instant.now());
    }

    @Test
    void shouldAdmitFirstAndQueueSecond() {
        CapacityScheduler scheduler = new CapacityScheduler(FactoryRunBudget.serialDefaults());

        CapacityDecision first = scheduler.request(run("RUN-1"));
        CapacityDecision second = scheduler.request(run("RUN-2"));

        // 首版容量合同：同一时刻只允许一个活动业务 Run
        assertInstanceOf(Admitted.class, first);
        QueuedForCapacity queued = assertInstanceOf(QueuedForCapacity.class, second);
        assertEquals("RUN-2", queued.runId());
        assertEquals(1, queued.queuePosition());
        assertEquals(1, scheduler.activeCount());
    }

    @Test
    void shouldReleaseCapacityAndHandOverNextWaiting() {
        CapacityScheduler scheduler = new CapacityScheduler(FactoryRunBudget.serialDefaults());

        scheduler.request(run("RUN-1"));
        scheduler.request(run("RUN-2"));

        // 释放活动执行权后，队列首个等待者应被交还
        Run next = scheduler.release("RUN-1");
        assertEquals("RUN-2", next.runId());
        assertEquals(0, scheduler.activeCount());
    }

    @Test
    void shouldKeepBudgetAtSerialDefaults() {
        FactoryRunBudget budget = FactoryRunBudget.serialDefaults();
        assertEquals(1, budget.maxConcurrentRuns());
        assertEquals(1, budget.perProjectQuota());
        assertEquals(PriorityPolicy.DEPENDENCY_THEN_BUSINESS_PRIORITY_THEN_FIFO,
                budget.priorityPolicy());
    }
}
