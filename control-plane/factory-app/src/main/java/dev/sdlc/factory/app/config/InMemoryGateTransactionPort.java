package dev.sdlc.factory.app.config;

import dev.sdlc.factory.contracts.gate.GateCommand;
import dev.sdlc.factory.contracts.gate.GateOutcome;
import dev.sdlc.factory.contracts.gate.GateResult;
import dev.sdlc.factory.gate.GateTransactionPort;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 门禁事务端口的内存实现（M0 纵向切片用）。
 *
 * <p>真实实现必须在同一数据库事务中完成
 * ReviewRecord 保存、Baseline 创建、生命周期推进与 Outbox 追加（v1.2 §10.1），
 * 由 factory-persistence 在 M1 提供基于 PostgreSQL 的适配器替换本类。</p>
 *
 * <p>当前实现保留幂等语义：相同 idempotencyKey 重复提交返回 IDEMPOTENT_REPLAY，
 * 与正式实现的对外合同一致，便于前端提前对接。</p>
 */
@Component
public class InMemoryGateTransactionPort implements GateTransactionPort {

    /** 幂等键 → 已处理结果。 */
    private final Map<String, GateResult> processed = new ConcurrentHashMap<>();

    /** 单调递增的结果序号（演示用途）。 */
    private final AtomicLong sequence = new AtomicLong();

    @Override
    public GateResult commit(GateCommand command) {
        // 幂等重放：相同 idempotencyKey 直接返回首次结果
        GateResult replayed = processed.get(command.idempotencyKey());
        if (replayed != null) {
            return new GateResult(replayed.resultId(), replayed.commandId(),
                    GateOutcome.IDEMPOTENT_REPLAY, replayed.actualVersion(),
                    replayed.reviewRecordRef(), replayed.baselineRef(), null, Instant.now());
        }

        long seq = sequence.incrementAndGet();
        GateResult result = new GateResult(
                "GRS-SLICE-%04d".formatted(seq),
                command.commandId(),
                GateOutcome.APPLIED,
                command.expectedVersion() + 1,
                "REV-SLICE-%04d".formatted(seq),
                null,
                null,
                Instant.now());
        processed.put(command.idempotencyKey(), result);
        return result;
    }
}
