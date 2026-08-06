package dev.sdlc.factory.lifecycle;

import dev.sdlc.factory.common.IllegalStateTransitionException;
import dev.sdlc.factory.lifecycle.command.Approve;
import dev.sdlc.factory.lifecycle.command.ArtifactsReady;
import dev.sdlc.factory.lifecycle.command.ExecutionFailure;
import dev.sdlc.factory.lifecycle.command.ExternalHold;
import dev.sdlc.factory.lifecycle.command.Reject;
import dev.sdlc.factory.lifecycle.command.Restart;
import dev.sdlc.factory.lifecycle.command.Resume;
import dev.sdlc.factory.lifecycle.command.StartSlice;
import dev.sdlc.factory.lifecycle.state.AwaitingReview;
import dev.sdlc.factory.lifecycle.state.Draft;
import dev.sdlc.factory.lifecycle.state.OnHold;
import dev.sdlc.factory.lifecycle.state.Running;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * v1.2 §4.3 状态机测试：合法迁移必须通过，非法迁移必须显式失败。
 */
class LifecycleStateMachineTest {

    @Test
    void shouldFollowHappyPath() {
        var state = LifecycleStateMachine.transition(Draft.INSTANCE, StartSlice.INSTANCE);
        assertEquals("RUNNING", state.name());

        state = LifecycleStateMachine.transition(state, ArtifactsReady.INSTANCE);
        assertEquals("AWAITING_REVIEW", state.name());

        state = LifecycleStateMachine.transition(state, Approve.INSTANCE);
        assertEquals("APPROVED", state.name());
    }

    @Test
    void shouldRejectAndRework() {
        var state = LifecycleStateMachine.transition(AwaitingReview.INSTANCE, Reject.INSTANCE);
        assertEquals("CHANGES_REQUESTED", state.name());

        state = LifecycleStateMachine.transition(state, StartSlice.INSTANCE);
        assertEquals("RUNNING", state.name());
    }

    @Test
    void shouldHoldAndResume() {
        var held = LifecycleStateMachine.transition(Running.INSTANCE,
                new ExternalHold("awaiting_environment"));
        assertInstanceOf(OnHold.class, held);
        assertEquals("awaiting_environment", ((OnHold) held).reason());

        var resumed = LifecycleStateMachine.transition(held, Resume.INSTANCE);
        assertEquals("RUNNING", resumed.name());
    }

    @Test
    void shouldFailAndRestart() {
        var failed = LifecycleStateMachine.transition(Running.INSTANCE,
                new ExecutionFailure("retry_budget_exceeded"));
        assertEquals("NEEDS_INTERVENTION", failed.name());

        var restarted = LifecycleStateMachine.transition(failed, Restart.INSTANCE);
        assertEquals("RUNNING", restarted.name());
    }

    @Test
    void shouldRejectIllegalTransitions() {
        // 草稿不能直接批准
        assertThrows(IllegalStateTransitionException.class,
                () -> LifecycleStateMachine.transition(Draft.INSTANCE, Approve.INSTANCE));
        // 待审核不能再启动切片
        assertThrows(IllegalStateTransitionException.class,
                () -> LifecycleStateMachine.transition(AwaitingReview.INSTANCE, StartSlice.INSTANCE));
        // 已批准是终态
        assertThrows(IllegalStateTransitionException.class,
                () -> LifecycleStateMachine.transition(
                        dev.sdlc.factory.lifecycle.state.Approved.INSTANCE, StartSlice.INSTANCE));
    }
}
