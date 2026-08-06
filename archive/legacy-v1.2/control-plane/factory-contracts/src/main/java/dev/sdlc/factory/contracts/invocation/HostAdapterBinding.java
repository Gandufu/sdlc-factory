package dev.sdlc.factory.contracts.invocation;

import java.util.Objects;

/**
 * 宿主适配器版本绑定（agent-invocation.schema.json: host_adapter）。
 *
 * <p>启动握手必须记录 Adapter、SDK 与 Host 的精确语义版本；
 * 任一版本不满足已验证兼容矩阵时拒绝创建 Run。</p>
 *
 * @param id            适配器标识
 * @param adapterVersion 适配器版本
 * @param hostVersion   宿主版本（以 /global/health 返回为准）
 * @param sdkVersion    SDK 版本（可选）
 */
public record HostAdapterBinding(
        String id, String adapterVersion, String hostVersion, String sdkVersion) {

    private static final String SEMVER = "^\\d+\\.\\d+\\.\\d+$";

    public HostAdapterBinding {
        Objects.requireNonNull(id, "id 不能为空");
        Objects.requireNonNull(adapterVersion, "adapterVersion 不能为空");
        Objects.requireNonNull(hostVersion, "hostVersion 不能为空");
        if (!adapterVersion.matches(SEMVER) || !hostVersion.matches(SEMVER)) {
            throw new dev.sdlc.factory.common.ContractViolationException("适配器/宿主版本必须为语义化版本");
        }
        if (sdkVersion != null && !sdkVersion.matches(SEMVER)) {
            throw new dev.sdlc.factory.common.ContractViolationException("SDK 版本必须为语义化版本");
        }
    }
}
