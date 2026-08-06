package dev.sdlc.factory.lifecycle.command;

/**
 * 生命周期命令（驱动 v1.2 §4.3 状态机的显式命令）。
 *
 * <p>v1.2 不变量 9：智能体、Hook、Observer 都不能推进业务状态，
 * 只有这些显式命令（由 Orchestrator 或操作人员提交）能触发迁移。</p>
 */
public sealed interface LifecycleCommand
        permits StartSlice, ArtifactsReady, ExternalHold, ExecutionFailure,
                Approve, Reject, Resume, Restart {
}
