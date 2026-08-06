package dev.sdlc.factory.app.web;

import dev.sdlc.factory.app.web.dto.TransitionRequest;
import dev.sdlc.factory.app.web.dto.TransitionResponse;
import dev.sdlc.factory.lifecycle.LifecycleStateMachine;
import dev.sdlc.factory.lifecycle.state.LifecycleState;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 生命周期状态机 REST 入口。
 *
 * <p>M0 切片阶段提供无状态迁移演算（前端与联调用）；
 * M1 起迁移将由 Gate 领域事务驱动并绑定阶段版本与审核记录。</p>
 */
@RestController
@RequestMapping("/api/lifecycle")
public class LifecycleController {

    /** 执行一次显式状态迁移。 */
    @PostMapping("/transitions")
    public TransitionResponse transition(@RequestBody TransitionRequest request) {
        LifecycleState current = LifecycleHttpAdapter.parseState(request.state());
        var command = LifecycleHttpAdapter.parseCommand(request.command(), request.reason());
        LifecycleState next = LifecycleStateMachine.transition(current, command);
        return new TransitionResponse(current.name(), next.name());
    }
}
