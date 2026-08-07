# 交接总结（2026-08-06）

## 项目背景
- 仓库：`D:\workspace\sdlc-factory`，AI 软件工厂 v1.2。
- 权威设计：`docs/v1.2/ai-software-factory-design-v1.2-final.md`；机器合同：`contracts/`（29 个 JSON Schema、正反例、`ddl/V1__v1_2_contract_baseline.sql`、TCK）。
- 本轮已做的架构评估结论：v1.2 技术选型整体合理、不做方向性修改；遗留两个待办决定：① M0 收尾前钉死 OpenCode SDK 表面（根入口 vs 新的 `./v2`，npm 已确认 `@opencode-ai/sdk@1.18.14` 存在 `./v2` 并行表面、接近每日发版）；② 把 `contracts/scripts/validate-opencode-compatibility.ps1` 变成每日自动跑的兼容 Smoke。

## 用户硬性要求（必须遵守）
1. 基于 **Spring Boot 4 + JDK 25**（覆盖 v1.2 文档中的 Boot 3/Java 21）。
2. **不使用内部类**：所有类/record/enum 一律顶层、单文件。
3. 代码**必须有中文注释**；有益时使用 Java 新特性（records/sealed/模式匹配/虚拟线程）、设计模式、模块拆分。
4. 数据访问用 **MyBatis-Plus**；**复杂多表 SQL 放 XML mapper**（简单 CRUD 用 BaseMapper）。
5. 前端单文件不要过大。
6. 回答用中文。

## 环境事实
- **JDK 25.0.4 Temurin 已装到 `D:\DevEnv\jdk-25`**（不在 PATH，构建需 `JAVA_HOME=D:\DevEnv\jdk-25`）。本机另有 JDK 21/24。
- Maven 3.9.10（`D:\DevEnv\apache-maven-3.9.10`）、Node 22.16、pnpm 11.17。
- **本机无 PostgreSQL（5432 未监听），Docker daemon 未运行**——集成运行前需要先解决（docker compose 起 postgres:16 或 winget 安装；docker 已装在 D:\DevEnv\docker 但服务未起）。

## 已完成的代码（全部已写盘，**尚未编译验证**）
`control-plane/` Maven 多模块（父 POM 继承 `spring-boot-starter-parent:4.1.0`，属性 `mybatis-plus.version=3.5.7`）：

| 模块 | 内容 | 状态 |
|---|---|---|
| factory-common | StableId、ContentHash、sealed 异常体系（FactoryException/ContractViolation/IllegalStateTransition） | 已写 + 测试 |
| factory-contracts | 12 个 P0 合同的 Java record（与 contracts/json-schema 一一对应，紧凑构造器强制合同条件约束：ErrorEnvelope/RunRequest/Handoff/Evidence/GateCommand/GateResult/ExecutionResult/RuntimeLease/HostRunEvent/HostRunResult/ContextManifest/AgentInvocation 及全部支撑枚举） | 已写 |
| factory-lifecycle | sealed 状态机（7 状态 + 8 命令，LifecycleStateMachine 用 switch 模式匹配）、StageScope 五种合法作用域组合、ReviewRecord（职责分离/单操作员豁免校验）、Baseline（类型-作用域约束、invalidate 不可变失效） | 已写 + 测试 |
| factory-orchestration | Run/RunState（与 DDL CHECK 一致）、FactoryRunBudget（max_concurrent_runs=1）、sealed CapacityDecision（Admitted/QueuedForCapacity）、CapacityScheduler、ExecutionSlice | 已写 + 测试 |
| factory-gate | GateService + GatePreconditionChecker + GateTransactionPort（端口） | 已写 |
| factory-runner | RunnerCommand/RunnerOutput/ProjectRunner 接口、ProcessTreeTerminator（ProcessHandle 进程树终止）、WindowsProcessRunner | 已写 + 测试（@EnabledOnOs(WINDOWS)） |
| factory-persistence | 5 个实体（Project/CapabilityUnit/Run/ReviewRecord/Baseline，@TableName/@TableId(INPUT)）、6 个 Mapper、RunDetailProjection record、**`resources/mapper/RunDetailQueryMapper.xml`（run×project×capability_unit 三表连接，<constructor> 显式映射到 record）** | 已写 |
| factory-app | FactoryApplication（@MapperScan）、FactoryBeansConfig（组合根）、InMemoryGateTransactionPort（幂等语义，M1 换数据库实现）、REST：/api/lifecycle/transitions、/api/capacity/request|release|board、/api/gates、SSE /api/runs/events、GlobalExceptionHandler（sealed 异常→ErrorEnvelope 模式匹配）、application.yml（loopback:8420、虚拟线程、snake_case Jackson、Flyway、MyBatis-Plus） | 已写 |
| Flyway | factory-app 用 maven-resources-plugin 把 `contracts/ddl/V*.sql` 构建期复制进 classpath（保持 DDL 唯一事实源，不复制第二份进 Git） | 已配置 |

## 未完成 / 下一步（按顺序）
1. **首次构建**：`$env:JAVA_HOME='D:\DevEnv\jdk-25'; cd D:\workspace\sdlc-factory\control-plane; mvn verify`。首次会拉取 Boot 4.1.0 依赖，耐心等待。修复编译/测试问题。
2. **调研文档已产出**：`docs/research/springboot4-jdk25-technology-research-2026-08-06.md`。已确认的结论（无需重查）：
   - Boot 选 **4.1.0**（父 POM 已是此版本，无需改）；JDK 25 一流支持；
   - `starter-web/jdbc`、`flyway-core/flyway-database-postgresql` 坐标在 Boot 4 均有效；Flyway 可改用新 `spring-boot-starter-flyway`（可选）；
   - `SseEmitter` 无变化且无虚拟线程 pinning；`spring.threads.virtual.enabled` 在 Boot 4 仍有效（yml 已配，无需改）；
   - maven-plugin 用法不变，repackage 只在 app 模块（已符合）；
   - ⚠️ string templates 已被撤回、primitive patterns/结构化并发仍是 preview——代码中未使用，保持不要引入；
   - Boot 4 有包名迁移（如 `@EntityScan` 搬家），本项目未用到受影响注解，编译报错时按 Migration Guide 换 import。
   **调研未覆盖的最大遗留问题：MyBatis-Plus 与 Boot 4/Spring Framework 7 兼容性**。处理顺序：a) 查 mybatis-plus GitHub releases/docs 是否已发布 Boot 4 适配 starter（如 mybatis-plus-spring-boot4-starter 或新版本线），有则升级坐标（父 POM 属性 `mybatis-plus.version` + factory-persistence 依赖）；b) 若无官方适配：boot3-starter 自动装配大概率失效，改为**手动装配**——自定义 `@Configuration` 提供 `MybatisSqlSessionFactoryBean`（DataSource + `classpath*:mapper/*.xml`）与 `MapperScannerConfigurer`，替换 factory-app 中的 `@MapperScan`；c) 实体/BaseMapper/XML 写法本身不受影响。另注意 Boot 4 的 Jackson 版本对 yml `spring.jackson.property-naming-strategy` 属性的影响（代码未直接用 Jackson API，构建后用 REST 验证 snake_case 输出）。
3. **数据库**：提供 PostgreSQL 16（建议写 `control-plane/docker-compose.yml`：postgres:16，db=sdlc_factory，user/password=factory，端口 5432），启动 Docker 或改用本机安装；然后 `mvn spring-boot:run` 验证 Flyway V1 迁移与 /actuator/health。
4. **任务 #5 前端**：`desktop-console/` React+Vite+TS 骨架（Projects/Attention/Operations 三入口 + 项目工作区），REST+SSE 客户端封装；参考 `prototypes/factory-console-prototype`（已有 Vite+React 依赖可复用）；单文件 ≤ 200 行。
5. 后续里程碑按 v1.2 文档 M1→M7；M1 需把 InMemoryGateTransactionPort 换成 PostgreSQL 事务实现（§10.1 事务序列 + Outbox + 幂等键）。

## 已知风险/注意点
- MyBatis record 结果映射依赖 `<constructor>` + `-parameters` 编译选项（父 POM 已开）。
- `GlobalExceptionHandler` 用 `RUN-NONE` 占位 run_id（符合合同正则，但正式版应关联真实 Run 或用独立信封类型）。
- contracts TCK 脚本（`contracts/scripts/*.ps1`）本轮未跑，交付前需执行一遍。
- 任务清单：#1 调研（后台，可能已产出文档）、#3 骨架（已写盘未编译）、#4 构建+测试、#5 前端。
