# Spring Boot 4 + JDK 25 技术选型调研

> 调研日期：2026-08-06
> 调研范围：Spring Boot 4.0/4.1 关键变化与版本选择、JDK 25 已定型特性、虚拟线程支持、Maven 多模块组织、Windows 上 JDK 25 获取方式
> 证据规则：只引用 Spring 官方博客/官方文档/官方 GitHub wiki、OpenJDK JEP 原文、Maven Central 元数据、各 JDK 发行版官方下载页与本机 winget 实测；无法核实的条目标注"未能核实"。

## 1. 结论先行

1. **Spring Boot 选 4.1.0（4.1.x 线）**：4.1.0 已于 2026-06-10 GA，是官方 Initializr 的默认版本，OSS 支持至 2027-07；4.0.x（当前 4.0.7）仍在支持期但只剩约 4 个月 OSS 支持（至 2026-12），新项目无理由选它。
2. **JDK 选 25（2025-09 LTS），发行版选 Eclipse Temurin，用 winget 安装**：`winget install EclipseAdoptium.Temurin.25.JDK`（当前 25.0.4+7-LTS）。Temurin / Microsoft OpenJDK / Amazon Corretto 均有 Windows x64 的 JDK 25 LTS 构建；不选 Oracle JDK（其 NFTC 许可条款本次未能核实）。
3. **Maven 组织方式：自定义聚合 pom 作 parent，`dependencyManagement` 中 import `org.springframework.boot:spring-boot-dependencies:4.1.0`**；`spring-boot-maven-plugin` 的 `repackage` 只放在最终可执行的应用模块（`control-plane-app`），库模块不 repackage。若不想自建 parent，直接继承 `spring-boot-starter-parent` 也可行。
4. **本项目技术栈坐标无破坏性变化**：`spring-boot-starter-web`、`spring-boot-starter-jdbc`、`spring-boot-starter-data-jdbc`、`flyway-core`、`flyway-database-postgresql` 在 Boot 4 下均可用；Flyway 官方新增推荐用 `spring-boot-starter-flyway`；SseEmitter 无弃用、无 API 变化，且自 Framework 6.1 起写锁已改为 `ReentrantLock`，与虚拟线程无 pinning 问题。
5. **虚拟线程**：`spring.threads.virtual.enabled=true` 在 Boot 4 中仍存在（覆盖 Tomcat/Jetty/@Async/任务调度/Kafka 监听器等），配合 JDK 25 可直接用于 SSE 长连接场景；**结构化并发（JEP 505）在 JDK 25 仍是第五轮 preview，不可用于生产代码**；ScopedValue 已在 JDK 25 定型（JEP 506）但 Spring Framework 7 无框架级支持，需要用 ScopedValue 时应走 Servlet Filter 而非 HandlerInterceptor（Spring 官方 issue 结论）。

---

## 2. Spring Boot 4.0 / 4.1 相对 Boot 3 的关键变化

### 2.1 基线版本

| 项目 | Boot 4 现状 | 来源 |
|---|---|---|
| Java 基线 | 最低 Java 17；对 Java 25 提供一流支持（"First class support for Java 25 (whilst retaining Java 17 compatibility)"） | [Spring Boot 4.0 Migration Guide](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide)、[4.0 GA 公告](https://spring.io/blog/2025/11/20/spring-boot-4-0-0-available-now) |
| Spring Framework | Boot 4.0 基于 Framework 7.0；Boot 4.1 基于 Framework 7.0.8；Framework 7.0 基线 JDK 17、推荐 JDK 25（最新 LTS） | [Boot 4.0 Release Notes](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Release-Notes)、[Boot 4.1 Release Notes](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.1-Release-Notes)、[Framework 7.0 Release Notes](https://github.com/spring-projects/spring-framework/wiki/Spring-Framework-7.0-Release-Notes) |
| Jakarta EE 基线 | Jakarta EE 11，Servlet 6.1 基线（对应 Tomcat 11.0 / Jetty 12.1）；另 Persistence 3.2、Validation 3.1、WebSocket 2.2 | [Boot 4.0 Migration Guide](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide)、[Boot 4.0 Release Notes](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Release-Notes) |
| 其他基线 | Kotlin 2.2+；GraalVM native-image 25+（如用相应特性） | [Boot 4.0 Migration Guide](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide) |

### 2.2 模块拆分（spring-boot / spring-boot-autoconfigure）

| 事实 | 说明 | 来源 |
|---|---|---|
| 完整模块化 | Boot 4.0 对整个代码库做模块化，提供"更小、更聚焦的 jar" | [4.0 GA 公告](https://spring.io/blog/2025/11/20/spring-boot-4-0-0-available-now) |
| 命名约定 | 新模块命名 `spring-boot-<technology>`，根包 `org.springframework.boot.<technology>` | [Boot 4.0 Migration Guide](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide) |
| 包名迁移 | 类型搬家示例：`@EntityScan` → `org.springframework.boot.persistence.autoconfigure.EntityScan`；`TestRestTemplate` → `org.springframework.boot.resttestclient.TestRestTemplate`；`BootstrapRegistry` → `org.springframework.boot.bootstrap` | [Boot 4.0 Migration Guide](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide) |
| autoconfigure 瘦身 | `spring-boot-autoconfigure` 工件仍在，但 4.0.0 jar 约 369 KB（3.5.0 约 2.0 MB），POM 唯一依赖是 `spring-boot`，各技术自动配置已移入对应模块 | [4.0.0 POM（Maven Central）](https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-autoconfigure/4.0.0/spring-boot-autoconfigure-4.0.0.pom) |
| 领域模块 | Maven Central 可见 `spring-boot-jdbc`、`spring-boot-webmvc`、`spring-boot-webflux`、`spring-boot-flyway`、`spring-boot-jpa`、`spring-boot-servlet`、`spring-boot-data-jdbc` 等（2026-08-06 实测） | [Maven Central org/springframework/boot](https://repo1.maven.org/maven2/org/springframework/boot/) |
| 迁移辅助 | 提供 `spring-boot-autoconfigure-classic` 兼容模块；`spring-boot-starter-classic` / `-test-classic` 用于快速迁移；迁移期可加 runtime 依赖 `spring-boot-properties-migrator` | [Migration Guide](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide)、[spring-boot-starter-classic metadata](https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-starter-classic/maven-metadata.xml)、[Upgrading 文档](https://docs.spring.io/spring-boot/upgrading.html) |
| Jackson | Jackson 3 取代 Jackson 2（新 `tools.jackson` 包），临时兼容模块 `spring-boot-jackson2` | [Boot 4.0 Migration Guide](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide) |
| starter 改名 | `spring-boot-starter-web` 的新规范名为 `spring-boot-starter-webmvc`；`spring-boot-starter-aop` → `spring-boot-starter-aspectj`；OAuth starter 加 `security-` 前缀 | [Boot 4.0 Migration Guide](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide) |

### 2.3 本项目关心的坐标（Maven Central 实测，2026-08-06）

| 坐标 | Boot 4 下状态 | 说明 | 来源 |
|---|---|---|---|
| `spring-boot-starter-web` | 仍存在（4.0.0…4.0.7、4.1.0） | 4.1.0 POM 依赖 starter-jackson、starter-tomcat、spring-boot-http-converter、spring-boot-webmvc | [metadata](https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-starter-web/maven-metadata.xml)、[4.1.0 POM](https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-starter-web/4.1.0/spring-boot-starter-web-4.1.0.pom) |
| `spring-boot-starter-webmvc` | Boot 4 新规范坐标 | 与 starter-web 核心依赖相同 | [metadata](https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-starter-webmvc/maven-metadata.xml) |
| `spring-boot-starter-jdbc` | 存在，latest 4.1.0 | — | [metadata](https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-starter-jdbc/maven-metadata.xml) |
| `spring-boot-starter-data-jdbc` | 存在，latest 4.1.0 | — | [metadata](https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-starter-data-jdbc/maven-metadata.xml) |
| `flyway-core` / `flyway-database-postgresql` | org.flywaydb 坐标不变（第三方库） | Maven Central 最新 13.1.0（2026-07-30）；Boot 4.1 管理版本为 12.4.0 | [flyway-core metadata](https://repo1.maven.org/maven2/org/flywaydb/flyway-core/maven-metadata.xml)、[Boot 4.1 Release Notes](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.1-Release-Notes) |
| `spring-boot-starter-flyway` | Boot 4 新增 starter | 迁移指南要求：此前只引第三方 flyway 依赖的项目应改用它 | [Migration Guide](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide)、[metadata](https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-starter-flyway/maven-metadata.xml) |

### 2.4 SSE（SseEmitter）与响应式流

| 事实 | 来源 |
|---|---|
| `SseEmitter` 在 Framework 7.0.8 javadoc 中未标注弃用（Since 4.2，API 不变） | [SseEmitter javadoc](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/mvc/method/annotation/SseEmitter.html) |
| Framework 7.0 Release Notes 与 Boot 4.0 Migration Guide 均未提及 SseEmitter/SSE 的任何变化或弃用 | [Framework 7.0 Release Notes](https://github.com/spring-projects/spring-framework/wiki/Spring-Framework-7.0-Release-Notes)、[Boot 4.0 Migration Guide](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide) |
| Framework 7.0 其他 Web 变化：新增 GsonEncoder/GsonDecoder；WebFlux 移除 Undertow 底层 HTTP 支持；MVC 与 WebFlux 均新增一等公民的 API 版本控制；WebClient 自动使用系统代理 | [Framework 7.0 Release Notes](https://github.com/spring-projects/spring-framework/wiki/Spring-Framework-7.0-Release-Notes) |
| Boot 4 弃用 `HttpMessageConverters`（改用 Client/ServerHttpMessageConvertersCustomizer）；Boot 4 已完全移除嵌入式 Undertow 支持 | [Boot 4.0 Migration Guide](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide)、[webserver how-to](https://docs.spring.io/spring-boot/how-to/webserver.html) |
| Reactive Streams 规范版本是否变化：未能核实 | — |

### 2.5 spring-boot-maven-plugin 用法变化

插件坐标不变：`org.springframework.boot:spring-boot-maven-plugin`（[插件文档](https://docs.spring.io/spring-boot/maven-plugin/index.html)、[goals 列表](https://docs.spring.io/spring-boot/maven-plugin/goals.html)：repackage、run、build-image、build-info、process-aot 等）。`layout` 取值不变：JAR、WAR、ZIP（别名 DIR）、NONE（[packaging 文档](https://docs.spring.io/spring-boot/maven-plugin/packaging.html)）。

| 变化 | 版本 | 来源 |
|---|---|---|
| 经典 uber-jar loader 被移除，需删除 `<loaderImplementation>CLASSIC</loaderImplementation>` | 4.0 | [Migration Guide](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide) |
| 嵌入式启动脚本（"fully executable" jar）支持被移除，uber jar 仍用 `java -jar` 运行 | 4.0 | 同上 |
| optional 依赖默认不再打进 uber jar，需要时设 `<includeOptional>true</includeOptional>` | 4.0 | 同上、[packaging 文档](https://docs.spring.io/spring-boot/maven-plugin/packaging.html) |
| 已弃用的 layertools jar mode 被移除 | 4.1 | [Boot 4.1 Release Notes](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.1-Release-Notes) |
| `-DskipTests` 不再跳过 AOT 处理，改为只响应 `maven.test.skip` | 4.1 | 同上 |
| layers 配置可从插件 classpath 的 `META-INF/spring/layers/<name>.xml` 加载 | 4.1 | 同上 |

---

## 3. Boot 4.0 与 4.1 该选哪个

| 事实 | 数据 | 来源 |
|---|---|---|
| Boot 4.0.0 GA | 2025-11-20（Phil Webb 公告；GitHub release published_at 2025-11-20T18:18:13Z） | [GA 公告](https://spring.io/blog/2025/11/20/spring-boot-4-0-0-available-now)、[v4.0.0 release](https://github.com/spring-projects/spring-boot/releases/tag/v4.0.0) |
| Boot 4.1.0 GA | 2026-06-10（Andy Wilkinson 公告；GitHub release published_at 2026-06-10T18:21:42Z） | [GA 公告](https://spring.io/blog/2026/06/10/spring-boot-4)、[v4.1.0 release](https://github.com/spring-projects/spring-boot/releases/tag/v4.1.0) |
| OSS 支持时间线 | 4.0.x OSS 支持至 2026-12（商业至 2027-12）；4.1.x OSS 至 2027-07（商业至 2028-07）；3.5.x OSS 已于 2026-06 结束 | [spring.io/projects/spring-boot#support](https://spring.io/projects/spring-boot#support) |
| Initializr 默认 | 官方 Initializr 默认生成 4.1.0（可选 4.0.7；4.1.1-SNAPSHOT、4.0.8-SNAPSHOT 开发中）→ 官方对新项目的事实推荐 | [start.spring.io metadata](https://start.spring.io/metadata/client) |
| 当前补丁线 | 4.0.x 最新 4.0.7（2026-06-25 发布）；4.1.x 最新 4.1.0 | [starter-web metadata](https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-starter-web/maven-metadata.xml)、[2026-06-25 发布博客](https://spring.io/blog/2026/06/25/spring-boot-3-5-16-available-now) |
| 支持政策 | 主版本至少 3 年（须运行受支持的 minor），minor 至少 12 个月；每年 5 月、11 月各一个 major/minor | [Supported Versions wiki](https://github.com/spring-projects/spring-boot/wiki/Supported-Versions) |

**结论：选 4.1.x。** 4.1.0 已 GA 且是 Initializr 默认；4.0.x 的 OSS 支持只剩至 2026-12，新项目没有理由从 4.0 起步。

---

## 4. JDK 25 可用于生产代码的已定型特性

### 4.1 JDK 25 身份

- JDK 25 于 **2025-09-16 GA**，官方原文："JDK 25 reached General Availability on 16 September 2025"、"JDK 25 will be a long-term support (LTS) release from most vendors"，上一个 LTS 为 JDK 21。来源：[openjdk.org/projects/jdk/25/](https://openjdk.org/projects/jdk/25/)。
- 注意：**不存在"JEP 494: JDK 25 is an LTS Release"这个 JEP**；JEP 494 实为 Module Import Declarations (Second Preview)（JDK 24）。JDK 25 的 LTS 身份以 OpenJDK 官方项目页为准。

### 4.2 JDK 25 新定型的特性（final/standard）

| 特性 | JEP | 说明 | 来源 |
|---|---|---|---|
| Module Import Declarations | JEP 511 | 一条 import 导入模块导出的全部包（JEP 476/494 两轮 preview 后定型） | [openjdk.org/jeps/511](https://openjdk.org/jeps/511) |
| Compact Source Files and Instance Main Methods | JEP 512 | 小文件程序无需 class/main 样板（四轮 preview 后定型） | [openjdk.org/jeps/512](https://openjdk.org/jeps/512) |
| Flexible Constructor Bodies | JEP 513 | 允许在 super()/this() 之前执行语句（三轮 preview 后定型） | [openjdk.org/jeps/513](https://openjdk.org/jeps/513) |
| Scoped Values | JEP 506 | 线程内及子线程共享不可变数据，比 ThreadLocal 更省、更配合虚拟线程（四轮 preview 后定型） | [openjdk.org/jeps/506](https://openjdk.org/jeps/506) |
| Compact Object Headers | JEP 519 | 对象头压缩到 64 位，堆占用可降约 10–20%（默认未开启） | [openjdk.org/jeps/519](https://openjdk.org/jeps/519) |
| Key Derivation Function API | JEP 510 | KDF API（HKDF、Argon2 等） | [openjdk.org/jeps/510](https://openjdk.org/jeps/510) |
| Generational Shenandoah | JEP 521 | Shenandoah GC 分代模式转正（默认仍单代） | [openjdk.org/jeps/521](https://openjdk.org/jeps/521) |
| AOT Command-Line Ergonomics | JEP 514 | 简化 AOT 缓存的命令行使用 | [openjdk.org/jeps/514](https://openjdk.org/jeps/514) |
| AOT Method Profiling | JEP 515 | 启动即携带上次运行的方法画像，缩短预热 | [openjdk.org/jeps/515](https://openjdk.org/jeps/515) |
| JFR Cooperative Sampling | JEP 518 | 协作式 JFR 栈采样 | [openjdk.org/jeps/518](https://openjdk.org/jeps/518) |
| JFR Method Timing & Tracing | JEP 520 | JFR 方法级计时与追踪 | [openjdk.org/jeps/520](https://openjdk.org/jeps/520) |
| Remove the 32-bit x86 Port | JEP 503 | 移除 32 位 x86 移植 | [openjdk.org/jeps/503](https://openjdk.org/jeps/503) |

### 4.3 历史已定型特性（JDK 25 中仍为标准特性）

| 特性 | JEP | 定型版本 | 来源 |
|---|---|---|---|
| Records | JEP 395 | JDK 16 | [openjdk.org/jeps/395](https://openjdk.org/jeps/395) |
| Sealed Classes | JEP 409 | JDK 17 | [openjdk.org/jeps/409](https://openjdk.org/jeps/409) |
| Record Patterns | JEP 440 | JDK 21 | [openjdk.org/jeps/440](https://openjdk.org/jeps/440) |
| Pattern Matching for switch | JEP 441 | JDK 21 | [openjdk.org/jeps/441](https://openjdk.org/jeps/441) |
| Virtual Threads | JEP 444 | JDK 21 | [openjdk.org/jeps/444](https://openjdk.org/jeps/444) |
| Unnamed Variables & Patterns | JEP 456 | JDK 22 | [openjdk.org/jeps/456](https://openjdk.org/jeps/456) |

### 4.4 String Templates 状态

- **已撤回（Withdrawn），不是 preview**。JEP 465（String Templates, Third Preview）状态字段为 "Closed / Withdrawn"，从未交付到任何版本；JDK 25 特性清单中无任何 String Templates 条目。来源：[openjdk.org/jeps/465](https://openjdk.org/jeps/465)、[openjdk.org/jeps/459](https://openjdk.org/jeps/459)、[openjdk.org/jeps/430](https://openjdk.org/jeps/430)。

### 4.5 JDK 25 中仍为 preview / 孵化 / 实验的特性（不可用于生产代码）

| 特性 | JEP | 轮次 | 来源 |
|---|---|---|---|
| Structured Concurrency | JEP 505 | 第五轮 preview | [openjdk.org/jeps/505](https://openjdk.org/jeps/505) |
| Primitive Types in Patterns, instanceof, and switch | JEP 507 | 第三轮 preview（JDK 24 编号为 JEP 488） | [openjdk.org/jeps/507](https://openjdk.org/jeps/507) |
| Stable Values | JEP 502 | 第一轮 preview | [openjdk.org/jeps/502](https://openjdk.org/jeps/502) |
| PEM Encodings of Cryptographic Objects | JEP 470 | 第一轮 preview | [openjdk.org/jeps/470](https://openjdk.org/jeps/470) |
| Vector API | JEP 508 | 第十轮孵化 | [openjdk.org/jeps/508](https://openjdk.org/jeps/508) |
| JFR CPU Time Profiling | JEP 509 | 实验特性 | [openjdk.org/jeps/509](https://openjdk.org/jeps/509) |

**生产可用性要点**：语言层面 JDK 25 真正新增可用的 final 语法只有模块导入声明（511）、紧凑源文件与实例 main（512）、灵活构造器体（513）；**primitive patterns（JEP 507）仍是 preview，不能用于生产代码**；Scoped Values（JEP 506）反而是 JDK 25 新定型的标准 API。JDK 25 完整特性清单（18 项）与 [openjdk.org/projects/jdk/25/](https://openjdk.org/projects/jdk/25/) 和 [JEP 0 索引](https://openjdk.org/jeps/0) 一致。

---

## 5. Spring Boot 4 / Framework 7 的虚拟线程与并发特性支持

### 5.1 spring.threads.virtual.enabled

属性在 Boot 4 中仍存在，默认 `false`，需 Java 21+（官方文档建议 Java 24+ 以获得最佳体验；启用后线程池相关属性不再生效；虚拟线程是 daemon 线程，建议配合 `spring.main.keep-alive=true`）。来源：[Boot 4 reference: Virtual threads](https://docs.spring.io/spring-boot/reference/features/spring-application.html#features.spring-application.virtual-threads)、[4.1.x 分支配置元数据源码](https://github.com/spring-projects/spring-boot/blob/4.1.x/core/spring-boot-autoconfigure/src/main/resources/META-INF/additional-spring-configuration-metadata.json)、[Threading.java](https://github.com/spring-projects/spring-boot/blob/4.1.x/core/spring-boot/src/main/java/org/springframework/boot/thread/Threading.java)。

| 组件 | 启用虚拟线程后的行为 | 来源 |
|---|---|---|
| @Async / AsyncTaskExecutor | 改用 `SimpleAsyncTaskExecutor`（虚拟线程） | [task-execution-and-scheduling 文档](https://docs.spring.io/spring-boot/reference/features/task-execution-and-scheduling.html) |
| 任务调度（@Scheduled） | 改用 `SimpleAsyncTaskScheduler`（忽略 pool 属性） | 同上 |
| MVC 异步请求、GraphQL Callable、JPA bootstrap、Bean 后台初始化等 | 复用自动配置的 `applicationTaskExecutor` | 同上 |
| Tomcat | ProtocolHandler executor 换为 `VirtualThreadExecutor` | [TomcatWebServerConfiguration.java](https://github.com/spring-projects/spring-boot/blob/4.1.x/module/spring-boot-tomcat/src/main/java/org/springframework/boot/tomcat/autoconfigure/TomcatWebServerConfiguration.java) |
| Jetty | 同机制的 Jetty customizer | [JettyWebServerConfiguration.java](https://github.com/spring-projects/spring-boot/blob/4.1.x/module/spring-boot-jetty/src/main/java/org/springframework/boot/jetty/autoconfigure/JettyWebServerConfiguration.java) |
| Kafka 监听器 | listener task executor 换为虚拟线程 executor | [KafkaAnnotationDrivenConfiguration.java](https://github.com/spring-projects/spring-boot/blob/4.1.x/module/spring-boot-kafka/src/main/java/org/springframework/boot/kafka/autoconfigure/KafkaAnnotationDrivenConfiguration.java) |
| JDK HttpClient 系列 HTTP client | Boot 4.0 起支持虚拟线程 | [Boot 4.0 Release Notes](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Release-Notes) |
| RedisMessageListenerContainer | 4.1.0 未覆盖，修复于 4.1.1 | [issue #50884](https://github.com/spring-projects/spring-boot/issues/50884) |

已知注意事项：Jetty + 虚拟线程在 Windows 上曾有冻结报告（[issue #50929](https://github.com/spring-projects/spring-boot/issues/50929)，2026-07 关闭为 external）——本项目用 Tomcat 不受影响。

### 5.2 结构化并发（Structured Concurrency）

- JDK 侧：JEP 505 在 JDK 25 仍是第五轮 preview（`java.util.concurrent.StructuredTaskScope`），未转正。来源：[openjdk.org/jeps/505](https://openjdk.org/jeps/505)
- Spring Framework 7 无集成、无文档说明：Framework 7.0 Release Notes 全文未提及 structured concurrency / StructuredTaskScope；issue 库无框架集成类 issue。来源：[Framework 7.0 Release Notes](https://github.com/spring-projects/spring-framework/wiki/Spring-Framework-7.0-Release-Notes)
- Micrometer context-propagation 仅有开放提案（[issue #419](https://github.com/micrometer-metrics/context-propagation/issues/419)、[issue #490](https://github.com/micrometer-metrics/context-propagation/issues/490)），均未实现。
- **官方路线图：未能核实**；现状只能归纳为"等 JDK 转正"。

### 5.3 Scoped Values

- JDK 侧：JDK 25 已定型（JEP 506）。来源：[openjdk.org/jeps/506](https://openjdk.org/jeps/506)
- Spring Framework 7 无框架级支持。唯一相关 issue [#32837 "Have HandlerInterceptor being ScopedValue friendly"](https://github.com/spring-projects/spring-framework/issues/32837) 被官方拒绝（declined）：ScopedValue 必须包裹一段执行，而 HandlerInterceptor 的 preHandle/postHandle/afterCompletion 是分离回调，无法包裹 handler；**官方建议改用 Servlet Filter**（它能包裹整个下游调用链）。
- context-propagation 对 JDK `java.lang.ScopedValue` 尚无传播支持（[issue #108](https://github.com/micrometer-metrics/context-propagation/issues/108) 仍 open；已合并的 [PR #123](https://github.com/micrometer-metrics/context-propagation/pull/123) 只是测试用模拟类）。

### 5.4 SSE + 虚拟线程

- SseEmitter 的写锁早在 Framework 6.1.0-M4 就从 `synchronized` 改为 `ReentrantLock` 以消除虚拟线程 pinning（[issue #30996](https://github.com/spring-projects/spring-framework/issues/30996)）；当前 main 分支 `ResponseBodyEmitter`（SseEmitter 父类）使用 `protected final Lock writeLock = new ReentrantLock()`（[源码](https://github.com/spring-projects/spring-framework/blob/main/spring-webmvc/src/main/java/org/springframework/web/servlet/mvc/method/annotation/ResponseBodyEmitter.java)）。
- **结论：Framework 7 中 SseEmitter 与虚拟线程无 pinning 问题，可直接用于本项目的 SSE 推送。**

---

## 6. Maven 多模块 + Spring Boot 4 BOM 的组织方式

### 6.1 parent 的两种方式（官方文档并列给出，未厚此薄彼）

| 方式 | 得到什么 | 失去/注意 | 来源 |
|---|---|---|---|
| 继承 `spring-boot-starter-parent` | 合理默认（Java 17 编译级别、UTF-8、`-parameters`、依赖管理、预配置的 `repackage` execution、`native` profile、资源过滤）；可用 properties 覆盖单个依赖版本 | parent 被占用 | [maven-plugin/using.html](https://docs.spring.io/spring-boot/maven-plugin/using.html) |
| `dependencyManagement` import BOM（`org.springframework.boot:spring-boot-dependencies:4.1.0`） | 依赖管理 | 只有依赖管理，没有插件管理；不能用 properties 覆盖版本，覆盖条目必须放在 spring-boot-dependencies 条目**之前** | [maven-plugin/using.html](https://docs.spring.io/spring-boot/maven-plugin/using.html)、[Maven BOM/import 机制](https://maven.apache.org/guides/introduction/introduction-to-dependency-mechanism.html) |

- Boot 官方文档没有专门的"多模块项目"章节（using.html、build-systems.html、structuring-your-code.html 均无多模块组织建议，后者只讲包结构与主类位置）。来源：[structuring-your-code.html](https://docs.spring.io/spring-boot/reference/using/structuring-your-code.html)
- BOM 版本核实：`spring-boot-dependencies` 的 [maven-metadata.xml](https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-dependencies/maven-metadata.xml) 显示 latest/release = 4.1.0（lastUpdated 2026-06-25）。

### 6.2 repackage 在多模块中的位置

官方 [packaging 文档](https://docs.spring.io/spring-boot/maven-plugin/packaging.html) 的关键论述（Custom Classifier 节原文）：

> "By default, the `repackage` goal replaces the original artifact with the repackaged one. That is a sane behavior for modules that represent an application but if your module is used as a dependency of another module, you need to provide a classifier for the repackaged one. The reason for that is that application classes are packaged in `BOOT-INF/classes` so that the dependent module cannot load a repackaged jar's classes."

即：**只有最终可执行的应用模块才 repackage**；会被其他模块依赖的模块要么不 repackage，要么加 `<classifier>`（如 `exec`）保留原始 jar。库模块可用 `skip` 参数（user property `spring-boot.repackage.skip`）跳过。官方文档未逐字写"repackage 只放在应用模块"，但 classifier/skip 两节即该结论的标准依据（同上 URL）。

### 6.3 本项目推荐组织

```
control-plane/（聚合 pom，packaging=pom）
├── pom.xml            # <modules> 聚合 + dependencyManagement import spring-boot-dependencies:4.1.0
├── control-plane-app/ # 可执行模块：唯一声明 spring-boot-maven-plugin repackage
├── control-plane-api/ # 库模块（REST 契约/DTO），不 repackage
├── control-plane-domain/
└── control-plane-infra/ # Flyway 迁移脚本、JDBC/JPA 配置
```

理由：聚合 parent 可自由控制编译器版本（设为 25）、模块划分与插件版本，且不受 starter-parent 的默认约定约束；若团队更看重开箱即用，直接继承 `spring-boot-starter-parent` 亦可，两者官方均支持。

---

## 7. Windows 上获取 JDK 25

### 7.1 各发行版可用性（2026-08-06 实测）

| 发行版 | Win x64 JDK 25 | 下载/安装方式 | winget 包 ID（本机实测） | 来源 |
|---|---|---|---|---|
| Eclipse Temurin (Adoptium) | 有（25.0.4+7-LTS，MSI + zip，含 SHA-256/签名） | MSI/zip 或 winget | `EclipseAdoptium.Temurin.25.JDK`（25.0.4.7，实测确认） | [Temurin releases](https://adoptium.net/temurin/releases/?version=25&os=windows&arch=x64&package=jdk)（JS 渲染页，用 [Adoptium API](https://api.adoptium.net/v3/assets/latest/25/hotspot?architecture=x64&image_type=jdk&os=windows) 核实） |
| Microsoft Build of OpenJDK | 有（25.0.4 LTS，exe/msi/zip 三种） | microsoft-jdk-25.0.4-windows-x64.* 或 winget | `Microsoft.OpenJDK.25`（25.0.4.7，实测确认） | [learn.microsoft.com/java/openjdk/download](https://learn.microsoft.com/java/openjdk/download) |
| Amazon Corretto | 有（25.0.4+7-LTS，MSI + zip） | [amazon-corretto-25-x64-windows-jdk.msi](https://corretto.aws/downloads/latest/amazon-corretto-25-x64-windows-jdk.msi) 或 winget | `Amazon.Corretto.25.JDK`（25.0.4.7，实测确认） | [Corretto 25 下载清单](https://docs.aws.amazon.com/corretto/latest/corretto-25-ug/downloads-list.html)、[Windows 安装说明](https://docs.aws.amazon.com/corretto/latest/corretto-25-ug/windows-install.html) |
| Oracle JDK 25 | 有（Windows x64 .exe 安装程序与 .msi 企业安装器；zip 是否存在未能核实） | jdk-25_windows-x64_bin.exe / .msi（下载页 www.oracle.com 在本环境被反爬拦截 403，改由官方安装指南核实文件名） | 未核实（本次未执行 Oracle 相关 winget 搜索） | [Oracle JDK 25 Windows 安装指南](https://docs.oracle.com/en/java/javase/25/install/installation-jdk-microsoft-windows-platforms.html)、[下载页（403，未能核实页面内容）](https://www.oracle.com/java/technologies/downloads/) |

### 7.2 Oracle 许可证

- Oracle NFTC（No-Fee Terms and Conditions）条款页 [oracle.com/downloads/licenses/no-fee-terms-license.html](https://www.oracle.com/downloads/licenses/no-fee-terms-license.html) 在本环境返回 403，**条款原文及 2025 年后是否有变化：未能核实**。按"只引用 oracle.com 官方页面"的证据规则，Oracle JDK 25 的生产使用许可条件本次未能核实；如需确认请人工在浏览器打开上述页面查看。

### 7.3 推荐

- **首选 Eclipse Temurin 25 + winget**：`winget install EclipseAdoptium.Temurin.25.JDK`。GPLv2+CE 许可无生产/商用限制；Adoptium 是社区事实标准（GitHub Actions setup-java、主流 CI 原生支持）。
- 备选：微软/Azure 生态用 `winget install Microsoft.OpenJDK.25`（同为 GPLv2+CE）；AWS 生态用 `winget install Amazon.Corretto.25.JDK`。
- 不推荐在无法核实 NFTC 条款现状的前提下将 Oracle JDK 25 用于本项目。
- 注意：winget 源中已出现非 LTS 的 JDK 26，选型时认准 25 的 LTS 标注，不要误装。

---

## 8. 最终选型建议

| 决策项 | 建议 | 依据章节 |
|---|---|---|
| Spring Boot 版本 | **4.1.0（4.1.x 线）**，等 4.1.1 发布后跟进补丁 | §3 |
| JDK | **25（LTS）**，发行版 **Eclipse Temurin**，安装 `winget install EclipseAdoptium.Temurin.25.JDK` | §7 |
| Maven 组织 | 自定义聚合 pom + BOM import `spring-boot-dependencies:4.1.0`；repackage 只在 `control-plane-app`；库模块不 repackage | §6 |
| Web/SSE | `spring-boot-starter-webmvc`（或兼容的 `spring-boot-starter-web`）+ Tomcat + SseEmitter（无弃用、无虚拟线程 pinning） | §2.4、§5.4 |
| 数据访问 | `spring-boot-starter-data-jdbc` + `spring-boot-starter-flyway`（含 flyway-core / flyway-database-postgresql，坐标不变，版本由 Boot BOM 管理） | §2.3 |
| 虚拟线程 | `spring.threads.virtual.enabled=true`（JDK 25 满足 Java 21+ 要求）；结构化并发仍是 preview（JEP 505），暂不进入生产代码；ScopedValue 已定型（JEP 506）但 Spring 无框架支持，需要时走 Servlet Filter | §5 |
| 编码可用的 JDK 25 新语法 | records、sealed、switch 模式匹配、record patterns、unnamed patterns、virtual threads 全部可用；新增可用：模块导入声明（JEP 511）、紧凑源文件与实例 main（JEP 512）、灵活构造器体（JEP 513）；**不要用** primitive patterns（仍 preview）、string templates（已撤回） | §4 |

### 未能核实项汇总

1. Reactive Streams 规范版本在 Framework 7 是否变化（§2.4）。
2. Spring Framework 7 对 StructuredTaskScope 的官方路线图（§5.2，只能推断为等 JDK 转正）。
3. context-propagation 对 JDK ScopedValue 的支持时间表（§5.3，相关 issue 均 open 且无里程碑）。
4. Oracle JDK 25 的 NFTC 许可条款现状与 Windows x64 zip 下载是否存在（§7，www.oracle.com 被反爬拦截）。
