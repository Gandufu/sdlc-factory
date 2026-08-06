package dev.sdlc.factory.contracts.lease;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/**
 * 运行时租约（runtime-lease.schema.json）。
 *
 * <p>start() 成功必须返回租约；复合模板可启动多个进程，
 * readiness 必须聚合所有必需模块。租约过期进程由 Reconciler 对账处理。
 * 清理令牌只保存哈希，不落明文。</p>
 *
 * @param runtimeId         RTM- 标识
 * @param ownerRunId        持有 Run
 * @param processHandles    进程句柄（至少一个）
 * @param endpoints         服务端点 URI
 * @param allocatedPorts    分配端口（1-65535）
 * @param startedAt         启动时间
 * @param readinessStatus   就绪状态
 * @param leaseExpiresAt    租约到期时间
 * @param cleanupTokenHash  清理令牌哈希
 */
public record RuntimeLease(
        String runtimeId,
        String ownerRunId,
        List<String> processHandles,
        List<String> endpoints,
        List<Integer> allocatedPorts,
        Instant startedAt,
        ReadinessStatus readinessStatus,
        Instant leaseExpiresAt,
        String cleanupTokenHash) {

    public RuntimeLease {
        Objects.requireNonNull(runtimeId, "runtimeId 不能为空");
        Objects.requireNonNull(ownerRunId, "ownerRunId 不能为空");
        Objects.requireNonNull(startedAt, "startedAt 不能为空");
        Objects.requireNonNull(readinessStatus, "readinessStatus 不能为空");
        Objects.requireNonNull(leaseExpiresAt, "leaseExpiresAt 不能为空");
        Objects.requireNonNull(cleanupTokenHash, "cleanupTokenHash 不能为空");
        processHandles = processHandles == null ? List.of() : List.copyOf(processHandles);
        if (processHandles.isEmpty()) {
            throw new dev.sdlc.factory.common.ContractViolationException("租约必须至少包含一个进程句柄");
        }
        endpoints = endpoints == null ? List.of() : List.copyOf(endpoints);
        allocatedPorts = allocatedPorts == null ? List.of() : List.copyOf(allocatedPorts);
        for (int port : allocatedPorts) {
            if (port < 1 || port > 65535) {
                throw new dev.sdlc.factory.common.ContractViolationException("非法端口：" + port);
            }
        }
        if (!cleanupTokenHash.matches("^sha256:[a-f0-9]{64}$")) {
            throw new dev.sdlc.factory.common.ContractViolationException("非法清理令牌哈希：" + cleanupTokenHash);
        }
    }
}
