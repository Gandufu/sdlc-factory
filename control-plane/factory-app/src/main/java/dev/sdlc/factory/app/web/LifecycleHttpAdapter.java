package dev.sdlc.factory.app.web;

import dev.sdlc.factory.common.ContractViolationException;
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
 * HTTP ↔ 生命周期领域对象的适配层（适配器模式）。
 *
 * <p>把 REST 层的字符串解析为密封的状态/命令对象；
 * 解析失败统一转为合同违规异常，由全局错误处理器输出 ErrorEnvelope。</p>
 */
public final class LifecycleHttpAdapter {

    /** 工具类禁止实例化。 */
    private LifecycleHttpAdapter() {
    }

    /** 按状态名解析状态对象。 */
    public static LifecycleState parseState(String name) {
        return switch (normalize(name)) {
            case "DRAFT" -> Draft.INSTANCE;
            case "RUNNING" -> Running.INSTANCE;
            case "AWAITING_REVIEW" -> AwaitingReview.INSTANCE;
            case "CHANGES_REQUESTED" -> ChangesRequested.INSTANCE;
            case "APPROVED" -> Approved.INSTANCE;
            // 带原因的状态不能由客户端直接构造，只能经由命令迁移产生
            case "ON_HOLD", "NEEDS_INTERVENTION" -> throw new ContractViolationException(
                    "状态 " + name + " 只能由迁移命令产生，不能作为初始状态提交");
            default -> throw new ContractViolationException("未知生命周期状态：" + name);
        };
    }

    /** 按命令名解析命令对象；需要原因的命令从 reason 参数取值。 */
    public static LifecycleCommand parseCommand(String name, String reason) {
        return switch (normalize(name)) {
            case "START_SLICE" -> StartSlice.INSTANCE;
            case "ARTIFACTS_READY" -> ArtifactsReady.INSTANCE;
            case "EXTERNAL_HOLD" -> new ExternalHold(requireReason(name, reason));
            case "EXECUTION_FAILURE" -> new ExecutionFailure(requireReason(name, reason));
            case "APPROVE" -> Approve.INSTANCE;
            case "REJECT" -> Reject.INSTANCE;
            case "RESUME" -> Resume.INSTANCE;
            case "RESTART" -> Restart.INSTANCE;
            default -> throw new ContractViolationException("未知生命周期命令：" + name);
        };
    }

    /** 统一大写规整，容忍 null。 */
    private static String normalize(String raw) {
        return raw == null ? "" : raw.trim().toUpperCase();
    }

    /** 原因必填校验。 */
    private static String requireReason(String commandName, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new ContractViolationException("命令 " + commandName + " 必须携带 reason");
        }
        return reason;
    }
}
