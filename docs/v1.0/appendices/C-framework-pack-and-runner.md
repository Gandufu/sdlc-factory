# 附录 C：Framework Pack 与 Runner

本附录定义 Framework Pack、ExecutionPlan、Interface/Environment 输入、TCK 和 `local_constrained` Runner。权威字段分别见 [FrameworkPack](../contracts/framework-pack.schema.json)、[ExecutionPlan](../contracts/execution-plan.schema.json)、[ExecutionReceipt](../contracts/execution-receipt.schema.json)、[InterfaceCatalog](../contracts/interface-catalog.schema.json) 与 [EnvironmentBinding](../contracts/environment-binding.schema.json) Schema。

## C.1 调用方向

```text
Host Adapter
  → Agent Interface
  → Application Use Case
      → Domain Kernel
      → FrameworkPackPort
      → HarnessRuntimePort
```

Application 编排 Port；Domain Kernel 不依赖 Pack、Runner、文件、Clock 或操作系统。完整依赖方向见 [ADR-002](../adr/ADR-002-Local-Core-Runner-Topology.md)。

Framework Pack 不能：

- 调用 Host Adapter；
- 修改 Task 生命周期；
- 生成 Operator Approval；
- 直接写 `.sdlc/**`；
- 在 ExecutionPlan 之外执行代码；
- 把原始命令暴露给模型。

M0 只实现声明式 Pack。只有两个真实 Pack 都无法表达必要行为时，才评估 executable provider seam。

## C.2 稳定对象

```text
PackDescriptor
ProjectInspection
CapabilityRequest
ExecutionPlan
ExecutionReceipt
CleanupToken
Diagnostic
ArtifactDescriptor
EnvironmentRequirement
GateInputManifest
```

ExecutionPlan 最少包含：

```text
argv
cwd
inputs / outputs
sideEffectClass
writable / protected paths
environment allowlist
required Secret refs
network policy
resource limits
timeout / cancellation points
readiness
cleanup
parser ID/version
invalidationInputs
```

## C.3 Pack 结构

```text
framework-packs/electron-react/
  template.yaml
  scaffold/                   # 可选
  context/
    architecture.md
    testing.md
  policies/
    paths.yaml
  tck/
    success-fixture/
    failure-fixture/
```

Manifest 的关键字段：

```yaml
apiVersion: sdlc.dev/framework-pack/v1alpha1
kind: FrameworkPack
metadata:
  id: electron-react
  version: 0.1.0
  digest: sha256:...

compatibility:
  core: ">=1.0.0-alpha <1.1.0"
  supportedOs: [windows]
  supportedArch: [x64]

requires:
  packs: []
  toolchains:
    - id: node
      version: ">=22 <23"

paths:
  writable:
    - src/**
    - tests/**
    - docs/sdlc/tasks/active/${task_id}/**
  protected:
    - .sdlc/**
    - docs/sdlc/project.md
    - docs/sdlc/requirements.md
    - docs/sdlc/architecture.md
    - docs/sdlc/verification.md
    - docs/sdlc/interfaces/**
    - docs/sdlc/environments/**
    - docs/sdlc/tasks/completed/**
    - .github/**
```

Capability 示例：

```yaml
capabilities:
  test.functional:
    runner: process
    argv: ["pnpm", "test:functional"]
    cwd: "."
    timeoutSeconds: 1200
    resultParser:
      id: playwright-json
      version: "1.0.0"
      digest: sha256:...
    blocking: true
    requiredEnvironment: ["runtime.port", "sso.issuer"]
    requiredSecretRefs: ["secret://sso/client-secret"]
    networkPolicy: declared_endpoints
    resourceLimits:
      cpuPercent: 80
      memoryBytes: 2147483648
      diskBytes: 1073741824
      processCount: 32
      logBytes: 104857600
    inputs:
      paths: ["src/**", "tests/functional/**", "package.json"]
    outputs:
      paths: ["test-results/**"]
      evidenceTypes: ["playwright", "screenshot", "log"]
    readiness: null
    cleanup: null
    invalidationInputs:
      paths: ["src/**", "tests/functional/**", "package.json"]
      facts: ["requirements", "interfaces", "verification"]
      bindings:
        - environment_binding_digest
        - framework_pack_digest
        - policy_digest
```

## C.4 标准 Capability

```text
project.inspect
dependencies.restore
code.check
test.unit
app.start
app.ready
test.functional
app.stop
package.build
```

M0 只操作已准备好的隔离 Electron canary，不提供通用 `scaffold.materialize` 或 `workspace.prepare` Capability。未来若启用脚手架，必须另行定义 Template Manifest、变量 Schema、生成文件 manifest、覆盖策略和 rollback；不能复用任意命令模板。

扩展使用命名空间：

```text
contract.openapi.validate
security.sbom.generate
device.yealink.smoke
```

Capability 只表达执行能力，不定义 Task 状态或审批策略。

## C.5 Pack 组合

目标模型：

```text
Project Profile
  + 0..N Framework Capability Pack
  + 0..N Policy Pack
```

M0 只实现：

```text
electron-react
+ default-local-policy
+ fake-canary
```

Schema 预留：

- pack ID/version/digest pinning；
- `requires` 依赖；
- Capability provider 唯一性；
- 显式优先级；
- 冲突和不兼容报告；
- Project Profile 对接口、环境、工具链和 mandatory gates 的选择。

多 Pack 组合在 M1/2.0 使用第二技术栈验证，不扩大 M0 实现。

## C.6 Interface Catalog

M0 只支持真实 canary 所需的最小接口目录：

```yaml
apiVersion: sdlc.dev/interface-catalog/v1alpha1
ownership:
  owner: ProjectFacts
  changePath: fact_change_set_delivery
interfaces:
  - id: EXT-SSO
    classification: external
    direction: outbound
    owningModule: application
    provider: enterprise-sso
    consumer: application
    protocol: oidc
    contractVersion: "1.0"
    contractRef: contracts/sso.md
    authenticationMode: oidc_client
    dataClassification: internal
    timeoutSeconds: 10
    retryExpectation: bounded
    readinessMethod: oidc_discovery
    testDoubleRef: testdouble://sso/default
    availabilityRequirement: required_for_functional
    endpointRef: env://sso.issuer
    requiredSecretRefs:
      - secret://sso/client-secret
```

Interface Catalog 是 ProjectFacts，可以由批准的 FactChangeSet 修改。Environment Binding、Secret Ref、Pack Binding 和 Policy 不属于普通 FactChangeSet，所有权与变更方式见[合同索引](../contracts/README.md#所有权)。

## C.7 Environment Binding

```yaml
apiVersion: sdlc.dev/environment-binding/v1alpha1
metadata:
  id: SIT-001
  type: sit
  revision: 1
  digest: sha256:...
ownership:
  owner: Operator
  changePath: operator_receipt
bindings:
  sso.issuer:
    value: https://sso-sit.example.test
    valueVersion: "1"
readiness:
  - interfaceId: EXT-SSO
    type: http
    path: /.well-known/openid-configuration
    timeoutSeconds: 10
testData:
  profileRef: testdata://sit/default-users
```

Environment Binding：

- 由 Operator 通过独立环境绑定命令与 Receipt 提供或批准；
- 以独立 digest 进入 Revision Vector；
- 拥有独立 `environment_binding_revision`，不能由 Agent 静默修改；
- Secret 只保存引用；
- 缺失绑定在运行前创建 Environment Suspension；
- 外部依赖不可用是 `environment` failure；
- 产品处理外部错误不正确才可能是 `product` failure。

非秘密值也必须带 `valueVersion`；Secret 绑定必须带 `secretRef + providerIdentity + secretVersion`。digest 只覆盖这些引用和版本元数据，不包含 Secret 明文。

## C.8 Framework Pack TCK

每个 Pack 必须验证：

1. Manifest Schema 和 Core version range；
2. 只允许 argv 数组，不允许 shell 字符串；
3. executable 必须由 pinned toolchain resolver 解析为绝对路径，并记录实际类型与 digest；
4. realpath/canonicalize 后不能通过 symlink、junction、大小写或 `..` 逃逸；
5. 未声明环境变量不得注入；
6. 后台进程必须有 readiness、timeout 和 cleanup；
7. success fixture 成功，failure fixture 被 parser 稳定识别；
8. cleanup 重复执行仍安全；
9. Evidence 包含 capability、时间、exit code、revision 和 stdout/stderr refs；
10. Pack 不能写 `.sdlc/**`、Receipt 或 Core policy；
11. 同一输入得到相同裁决；
12. Pack digest 改变后旧 GateRun stale；
13. `invalidationInputs` 可以形成确定性 GateInputManifest；
14. `.cmd/.bat/PowerShell/npm/pnpm` 间接 shell 必须在 ExecutionReceipt 标记，不能把 argv 数组描述成“无 shell”。

## C.9 M0 Runner 安全边界

`argv` 只防止直接字符串拼接注入，不等于无 shell 或安全沙箱。Runner 至少提供：

- clean environment；
- pinned toolchain resolver、绝对 executable path、类型和 digest；
- canonical path 和 symlink/junction escape 检查；
- Windows 业务进程以 suspended 方式创建，加入 Job Object 后才恢复执行；
- timeout 后先请求协作退出，再强制结束 Job；
- orphan process 检测和 Cleanup Receipt；
- Electron 临时 `user-data-dir`；
- 动态端口分配和回收；
- Secret allowlist；网络策略只按实际 enforcement 能力声明；
- 日志脱敏；
- CPU、内存、磁盘、进程数和日志大小限制；
- Pack digest 在运行前后校验；
- Operation 开始和结束 revision 各采样一次。

控制项必须按 [Runner Enforcement Matrix](../contracts/runner-enforcement.yaml) 标记 `enforced`、`observed` 或 `not_enforced`。请求强保证但有效级别不足时，Gate 在启动前 Suspension；不能用 Receipt 记录后继续冒充已经强制。

M0 的权威 canary 平台固定为 Windows x64，Electron Pack 只能在 `supportedOs/supportedArch` 中声明已经通过 TCK 和进程清理故障注入的平台。Schema 允许 Linux/macOS，但 M0 不实现 POSIX process group，也不对未验证平台作完成声明。M1 再选择一个 POSIX 平台验证第二套进程树 Adapter。

1.0 安全等级是 `local_constrained`，只运行受控 canary 和受信项目。容器/VM、hostile-code sandbox 和强网络隔离属于 2.0 Execution Plane。
