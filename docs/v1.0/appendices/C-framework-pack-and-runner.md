# 附录 C：Framework Pack 与 Runner

本附录定义 Framework Pack、ExecutionPlan、Interface/Environment 输入、TCK 和 `local_constrained` Runner。

## C.1 调用方向

```text
Host Adapter
  → Agent Interface
  → Application
  → Domain Kernel
  → Framework Pack Port
  → Harness Runtime Port
```

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
  supportedOs: [windows, linux, darwin]
  supportedArch: [x64, arm64]

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
    resultParser: playwright-json
    blocking: true
    requiredEnvironment: ["runtime.port", "sso.issuer"]
    inputs:
      paths: ["src/**", "tests/functional/**", "package.json"]
    outputs:
      evidenceTypes: ["playwright", "screenshot", "log"]
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
scaffold.materialize
workspace.prepare
dependencies.restore
code.check
test.unit
app.start
app.ready
test.functional
app.stop
package.build
```

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
interfaces:
  - id: EXT-SSO
    classification: external
    provider: enterprise-sso
    consumer: application
    protocol: oidc
    contractRef: contracts/sso.md
    endpointRef: env://sso.issuer
    requiredSecretRefs:
      - secret://sso/client-secret
```

Interface Catalog 是 ProjectFacts，可以由批准的 FactChangeSet 修改。

## C.7 Environment Binding

```yaml
apiVersion: sdlc.dev/environment-binding/v1alpha1
metadata:
  id: SIT-001
  type: sit
bindings:
  sso.issuer:
    value: https://sso-sit.example.test
readiness:
  - interfaceId: EXT-SSO
    type: http
    path: /.well-known/openid-configuration
    timeoutSeconds: 10
testData:
  profileRef: testdata://sit/default-users
```

Environment Binding：

- 由 Operator 提供或批准；
- 以独立 digest 进入 Revision Vector；
- Secret 只保存引用；
- 缺失绑定在运行前创建 Environment Suspension；
- 外部依赖不可用是 `environment` failure；
- 产品处理外部错误不正确才可能是 `product` failure。

## C.8 Framework Pack TCK

每个 Pack 必须验证：

1. Manifest Schema 和 Core version range；
2. 只允许 argv 数组，不允许 shell 字符串；
3. realpath/canonicalize 后不能通过 symlink、junction、大小写或 `..` 逃逸；
4. 未声明环境变量不得注入；
5. 后台进程必须有 readiness、timeout 和 cleanup；
6. success fixture 成功，failure fixture 被 parser 稳定识别；
7. cleanup 重复执行仍安全；
8. Evidence 包含 capability、时间、exit code、revision 和 stdout/stderr refs；
9. Pack 不能写 `.sdlc/**`、Receipt 或 Core policy；
10. 同一输入得到相同裁决；
11. Pack digest 改变后旧 GateRun stale；
12. `invalidationInputs` 可以形成确定性 GateInputManifest。

## C.9 M0 Runner 安全边界

`argv` 不等于安全。Runner 至少提供：

- clean environment；
- canonical path 和 symlink/junction escape 检查；
- Windows Job Object 或等价进程树管理；
- POSIX process group；
- timeout 后 TERM → KILL；
- orphan process 检测和 Cleanup Receipt；
- Electron 临时 `user-data-dir`；
- 动态端口分配和回收；
- Secret/网络白名单；
- 日志脱敏；
- CPU、内存、磁盘、进程数和日志大小限制；
- Pack digest 在运行前后校验；
- Operation 开始和结束 revision 各采样一次。

若当前 OS 无法强制某项限制，Receipt 必须记录 `not_enforced`；高风险 Gate 创建 Suspension，不能静默继续。

1.0 安全等级是 `local_constrained`，只运行受控 canary 和受信项目。容器/VM、hostile-code sandbox 和强网络隔离属于 2.0 Execution Plane。
