package dev.sdlc.factory.app.config;

import dev.sdlc.factory.gate.GatePreconditionChecker;
import dev.sdlc.factory.gate.GateService;
import dev.sdlc.factory.gate.GateTransactionPort;
import dev.sdlc.factory.orchestration.CapacityScheduler;
import dev.sdlc.factory.orchestration.FactoryRunBudget;
import dev.sdlc.factory.runner.ProcessTreeTerminator;
import dev.sdlc.factory.runner.WindowsProcessRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 领域 Bean 装配。
 *
 * <p>领域模块不依赖 Spring，统一在本配置类完成组装（组合根模式）。</p>
 */
@Configuration
public class FactoryBeansConfig {

    /** 容量调度器：首版固定串行容量合同。 */
    @Bean
    public CapacityScheduler capacityScheduler() {
        return new CapacityScheduler(FactoryRunBudget.serialDefaults());
    }

    /** 门禁服务：前置校验 + 事务端口（当前为内存实现，M1 后替换为数据库事务）。 */
    @Bean
    public GateService gateService(GateTransactionPort transactionPort) {
        return new GateService(new GatePreconditionChecker(), transactionPort);
    }

    /** Windows 原生执行器（含进程树终止器）。 */
    @Bean
    public WindowsProcessRunner windowsProcessRunner() {
        return new WindowsProcessRunner(new ProcessTreeTerminator());
    }
}
