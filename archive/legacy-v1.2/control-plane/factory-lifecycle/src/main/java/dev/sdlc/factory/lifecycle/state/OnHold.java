package dev.sdlc.factory.lifecycle.state;

import java.util.Objects;

/**
 * 挂起态：外部条件不满足（缺设备、第三方不可用、等待澄清等）。
 *
 * <p>挂起原因对应 v1.2 §9.4 的 OnHold 枚举；
 * CU 挂起后调度器重新计算其他 CU 就绪状态，不阻塞无依赖 CU。</p>
 *
 * @param reason 挂起原因
 */
public record OnHold(String reason) implements LifecycleState {

    public OnHold {
        Objects.requireNonNull(reason, "挂起必须携带原因");
        if (reason.isBlank()) {
            throw new IllegalArgumentException("挂起原因不能为空串");
        }
    }

    @Override
    public String name() {
        return "ON_HOLD";
    }
}
