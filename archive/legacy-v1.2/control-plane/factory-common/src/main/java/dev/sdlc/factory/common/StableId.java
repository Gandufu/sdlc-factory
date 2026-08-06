package dev.sdlc.factory.common;

import java.util.Objects;
import java.util.regex.Pattern;

/**
 * 稳定标识（Stable ID）。
 *
 * <p>v1.2 机器合同规定所有领域标识都携带类型前缀（如 RUN-、PRJ-、GCM-），
 * 且前缀后必须跟随大写字母或数字组成的主体。本 record 在构造时统一校验，
 * 避免非法 ID 流入合同边界。</p>
 *
 * @param prefix ID 类型前缀（不含连字符），如 "RUN"
 * @param value  完整 ID 值，如 "RUN-01J9XYZ"
 */
public record StableId(String prefix, String value) {

    /** 合同规定的 ID 主体模式：前缀-大写字母数字（可含连字符分段）。 */
    private static Pattern idPattern(String prefix) {
        return Pattern.compile("^" + prefix + "-[A-Z0-9][A-Z0-9-]*$");
    }

    /**
     * 紧凑构造器：校验前缀与完整值的一致性，防止调用方传入互相矛盾的参数。
     */
    public StableId {
        Objects.requireNonNull(prefix, "prefix 不能为空");
        Objects.requireNonNull(value, "value 不能为空");
        if (!idPattern(prefix).matcher(value).matches()) {
            throw new ContractViolationException(
                    "非法稳定标识：期望前缀 %s，实际值 %s".formatted(prefix, value));
        }
    }

    /** 工厂方法：按给定前缀解析并校验一个完整 ID。 */
    public static StableId of(String prefix, String value) {
        return new StableId(prefix, value);
    }

    /** Run 标识（RUN-）。 */
    public static StableId run(String value) {
        return new StableId("RUN", value);
    }

    /** 项目标识（PRJ-）。 */
    public static StableId project(String value) {
        return new StableId("PRJ", value);
    }

    /** 门禁命令标识（GCM-）。 */
    public static StableId gateCommand(String value) {
        return new StableId("GCM", value);
    }

    @Override
    public String toString() {
        return value;
    }
}
