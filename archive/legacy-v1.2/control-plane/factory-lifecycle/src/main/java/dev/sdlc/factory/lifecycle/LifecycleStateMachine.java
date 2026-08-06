package dev.sdlc.factory.lifecycle;

import dev.sdlc.factory.common.IllegalStateTransitionException;
import dev.sdlc.factory.lifecycle.command.Approve;
import dev.sdlc.factory.lifecycle.command.ArtifactsReady;
import dev.sdlc.factory.lifecycle.command.ExecutionFailure;
import dev.sdlc.factory.lifecycle.command.ExternalHold;
import dev.sdlc.factory.lifecycle.command.LifecycleCommand;
import dev.sdlc.factory.lifecycle.command.Reject;
import dev.sdlc.factory.lifecycle.command.Restart;
import dev.sdlc.factory.lifecycle.command.Resume;
import dev.sdlc.factory.lifecycle.command.StartSlice;
import dev.sdlc.factory.lifecycle.state.Approved;
import dev.sdlc.factory.lifecycle.state.AwaitingReview;
import dev.sdlc.factory.lifecycle.state.ChangesRequested;
import dev.sdlc.factory.lifecycle.state.Draft;
import dev.sdlc.factory.lifecycle.state.LifecycleState;
import dev.sdlc.factory.lifecycle.state.NeedsIntervention;
import dev.sdlc.factory.lifecycle.state.OnHold;
import dev.sdlc.factory.lifecycle.state.Running;

/**
 * 生命周期阶段状态机（v1.2 §4.3）。
 *
 * <p>实现要点：</p>
 * <ul>
 *   <li>纯函数式设计：transition 不持有任何状态，便于测试与并发使用；</li>
 *   <li>对状态与命令做双层 switch 模式匹配（JDK 21+ 定型特性），
 *       sealed 类型保证编译器做穷尽性检查；</li>
 *   <li>一切未显式声明的（状态, 命令）组合都抛出
 *       {@link IllegalStateTransitionException}——非法迁移绝不静默忽略。</li>
 * </ul>
 */
public final class LifecycleStateMachine {

    /** 工具类禁止实例化。 */
    private LifecycleStateMachine() {
    }

    /**
     * 执行一次状态迁移。
     *
     * @param current 当前状态
     * @param command 显式命令
     * @return 迁移后的新状态
     * @throws IllegalStateTransitionException 当前状态不允许该命令
     */
    public static LifecycleState transition(LifecycleState current, LifecycleCommand command) {
        // 外层按状态分发；每个分支内再按命令匹配，未匹配的组合落入非法迁移
        return switch (current) {
            case Draft ignored -> switch (command) {
                case StartSlice start -> Running.INSTANCE;
                default -> illegal(current, command);
            };
            case Running ignored -> switch (command) {
                case ArtifactsReady ready -> AwaitingReview.INSTANCE;
                case ExternalHold hold -> new OnHold(hold.reason());
                case ExecutionFailure failure -> new NeedsIntervention(failure.reason());
                default -> illegal(current, command);
            };
            case AwaitingReview ignored -> switch (command) {
                case Approve approve -> Approved.INSTANCE;
                case Reject reject -> ChangesRequested.INSTANCE;
                default -> illegal(current, command);
            };
            case ChangesRequested ignored -> switch (command) {
                case StartSlice start -> Running.INSTANCE;
                default -> illegal(current, command);
            };
            case OnHold ignored -> switch (command) {
                case Resume resume -> Running.INSTANCE;
                default -> illegal(current, command);
            };
            case NeedsIntervention ignored -> switch (command) {
                case Restart restart -> Running.INSTANCE;
                default -> illegal(current, command);
            };
            // Approved 是终态：任何命令都不允许
            case Approved ignored -> illegal(current, command);
        };
    }

    /** 统一构造非法迁移异常，携带状态与命令的可读信息。 */
    private static LifecycleState illegal(LifecycleState state, LifecycleCommand command) {
        throw new IllegalStateTransitionException(
                "状态 %s 不允许命令 %s".formatted(state.name(), command.getClass().getSimpleName()));
    }
}
