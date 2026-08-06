package dev.sdlc.factory.gate;

import dev.sdlc.factory.contracts.gate.GateCommand;
import dev.sdlc.factory.contracts.gate.GateResult;

import java.util.Objects;

/**
 * 门禁服务（v1.2 §2.1 Gate Service）。
 *
 * <p>职责：校验产物、证据和审核前置条件，然后委托事务端口提交领域事务；
 * 不负责从聊天文本猜测结论，也不绕过生命周期状态。</p>
 *
 * <p>设计模式：模板方法思想的轻量实现——校验步骤固定在本类，
 * 事务提交委托给 {@link GateTransactionPort}，便于替换数据库实现或测试替身。</p>
 */
public final class GateService {

    private final GatePreconditionChecker preconditionChecker;
    private final GateTransactionPort transactionPort;

    public GateService(GatePreconditionChecker preconditionChecker, GateTransactionPort transactionPort) {
        this.preconditionChecker = Objects.requireNonNull(preconditionChecker, "preconditionChecker 不能为空");
        this.transactionPort = Objects.requireNonNull(transactionPort, "transactionPort 不能为空");
    }

    /**
     * 处理一次门禁裁决。
     *
     * @param command 门禁命令
     * @return 门禁结果；前置校验失败时由事务端口或调用方转为 REJECTED
     * @throws dev.sdlc.factory.common.ContractViolationException 合同违规
     */
    public GateResult decide(GateCommand command) {
        preconditionChecker.check(command);
        return transactionPort.commit(command);
    }
}
