package dev.sdlc.factory.app.web;

import dev.sdlc.factory.app.web.dto.CapacityRequestPayload;
import dev.sdlc.factory.contracts.run.RunStage;
import dev.sdlc.factory.orchestration.CapacityDecision;
import dev.sdlc.factory.orchestration.CapacityScheduler;
import dev.sdlc.factory.orchestration.Run;
import dev.sdlc.factory.orchestration.RunState;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 容量调度 REST 入口。
 *
 * <p>v1.2：容量不足的请求进入 QUEUED_FOR_CAPACITY，
 * 不记为失败、不消耗重试预算。</p>
 */
@RestController
@RequestMapping("/api/capacity")
public class CapacityController {

    private final CapacityScheduler scheduler;

    public CapacityController(CapacityScheduler scheduler) {
        this.scheduler = scheduler;
    }

    /** 为一个 Run 申请活动执行权。 */
    @PostMapping("/request")
    public CapacityDecision request(@RequestBody CapacityRequestPayload payload) {
        Run candidate = new Run(
                payload.runId(),
                payload.projectId(),
                payload.cuId(),
                RunStage.valueOf(payload.stage()),
                RunState.QUEUED_FOR_CAPACITY,
                Instant.now());
        return scheduler.request(candidate);
    }

    /** 释放活动执行权（Run 结束/挂起/取消时调用）。 */
    @PostMapping("/release")
    public Map<String, Object> release(@RequestBody Map<String, String> body) {
        Run next = scheduler.release(body.get("run_id"));
        return Map.of(
                "released", true,
                "next_waiting_run", next == null ? "none" : next.runId());
    }

    /** Operations 看板只读投影：容量合同、活动数与等待队列。 */
    @GetMapping("/board")
    public Map<String, Object> board() {
        List<String> waiting = scheduler.waitingSnapshot().stream().map(Run::runId).toList();
        return Map.of(
                "budget", scheduler.budget(),
                "active_count", scheduler.activeCount(),
                "waiting_runs", waiting);
    }
}
