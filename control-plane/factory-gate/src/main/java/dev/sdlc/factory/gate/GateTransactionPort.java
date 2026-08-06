package dev.sdlc.factory.gate;

import dev.sdlc.factory.contracts.gate.GateCommand;
import dev.sdlc.factory.contracts.gate.GateResult;

/**
 * 门禁领域事务端口（Ports & Adapters 模式）。
 *
 * <p>对应 v1.2 §10.1 的领域事务序列：</p>
 * <pre>
 * validate expected stage version
 * → validate artifact/evidence bindings
 * → save ReviewRecord
 * → create immutable Baseline refs
 * → advance lifecycle state
 * → invalidate downstream refs
 * → append Outbox/ReconciliationRecord
 * </pre>
 * <p>以上记录必须在同一数据库事务中提交，并使用 expected_version、
 * review_id 与幂等键防止重复提交。factory-gate 模块不依赖数据库实现，
 * 具体事务由 factory-persistence 提供的适配器完成。</p>
 */
public interface GateTransactionPort {

    /**
     * 在当前阶段版本上提交门禁事务。
     *
     * @param command 已通过前置校验的门禁命令
     * @return 门禁结果（APPLIED / IDEMPOTENT_REPLAY）
     */
    GateResult commit(GateCommand command);
}
