package dev.sdlc.factory.app.config;

import dev.sdlc.factory.gate.GatePreconditionChecker;
import dev.sdlc.factory.gate.GateService;
import dev.sdlc.factory.gate.GateTransactionPort;
import dev.sdlc.factory.orchestration.CapacityScheduler;
import dev.sdlc.factory.orchestration.FactoryRunBudget;
import dev.sdlc.factory.runner.ProcessTreeTerminator;
import dev.sdlc.factory.runner.WindowsProcessRunner;
import dev.sdlc.factory.app.initialization.NodeTemplateAdapter;
import dev.sdlc.factory.app.initialization.ProjectInitializationService;
import dev.sdlc.factory.persistence.ProjectInitializationRepository;
import dev.sdlc.factory.persistence.HostAcceptanceRepository;
import dev.sdlc.factory.persistence.WorkspaceRepository;
import dev.sdlc.factory.app.host.HostAcceptanceService;
import dev.sdlc.factory.app.host.OpenCodeProcessAdapter;
import dev.sdlc.factory.app.workspace.WorkspaceService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.ObjectMapper;

import java.nio.file.Path;
import java.time.Duration;

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

    /** M1 项目初始化：显式 SQL 存储、固定 Node 模板和事务编排。 */
    @Bean
    public ProjectInitializationRepository projectInitializationRepository(JdbcTemplate jdbcTemplate) {
        return new ProjectInitializationRepository(jdbcTemplate);
    }

    @Bean
    public NodeTemplateAdapter nodeTemplateAdapter(WindowsProcessRunner runner) {
        return new NodeTemplateAdapter(runner);
    }

    @Bean
    public ProjectInitializationService projectInitializationService(
            ProjectInitializationRepository repository,
            NodeTemplateAdapter template,
            PlatformTransactionManager transactionManager) {
        return new ProjectInitializationService(repository, template,
                new TransactionTemplate(transactionManager));
    }

    @Bean
    public HostAcceptanceRepository hostAcceptanceRepository(JdbcTemplate jdbcTemplate) {
        return new HostAcceptanceRepository(jdbcTemplate);
    }

    @Bean
    public OpenCodeProcessAdapter openCodeProcessAdapter(
            WindowsProcessRunner runner,
            ObjectMapper objectMapper,
            @Value("${factory.opencode-adapter-root:${user.dir}/../agent-adapters/opencode}") String adapterRoot,
            @Value("${factory.contracts-root:${user.dir}/../contracts/json-schema}") String contractsRoot) {
        return new OpenCodeProcessAdapter(runner, objectMapper, Path.of(adapterRoot),
                Path.of(contractsRoot), Duration.ofMinutes(5));
    }

    @Bean
    public HostAcceptanceService hostAcceptanceService(
            HostAcceptanceRepository repository,
            OpenCodeProcessAdapter adapter,
            ObjectMapper objectMapper,
            PlatformTransactionManager transactionManager,
            @Value("${factory.contracts-root:${user.dir}/../contracts/json-schema}") String contractsRoot) {
        return new HostAcceptanceService(repository, adapter, objectMapper,
                new TransactionTemplate(transactionManager), Path.of(contractsRoot));
    }

    @Bean
    public WorkspaceRepository workspaceRepository(JdbcTemplate jdbcTemplate,
                                                   PlatformTransactionManager transactionManager) {
        return new WorkspaceRepository(jdbcTemplate, new TransactionTemplate(transactionManager));
    }

    @Bean
    public WorkspaceService workspaceService(WorkspaceRepository repository,
                                             HostAcceptanceService hostAcceptanceService,
                                             PlatformTransactionManager transactionManager) {
        return new WorkspaceService(repository, hostAcceptanceService,
                new TransactionTemplate(transactionManager));
    }
}
