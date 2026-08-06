package dev.sdlc.factory.common;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * 内容哈希（Content Hash）。
 *
 * <p>v1.2 全部合同中的 content_hash 字段统一为 {@code sha256:<64 位小写十六进制>}。
 * 内容寻址存储、基线条目、生产资料版本都以它为不可变锚点。</p>
 *
 * @param algorithm 哈希算法，当前固定为 "sha256"
 * @param hex       64 位小写十六进制摘要
 */
public record ContentHash(String algorithm, String hex) {

    /** 合同规定的序列化格式：sha256:64 位小写十六进制。 */
    private static final Pattern CANONICAL = Pattern.compile("^sha256:[a-f0-9]{64}$");

    public ContentHash {
        Objects.requireNonNull(algorithm, "algorithm 不能为空");
        Objects.requireNonNull(hex, "hex 不能为空");
        if (!"sha256".equals(algorithm)) {
            throw new ContractViolationException("当前仅支持 sha256 内容哈希：" + algorithm);
        }
        if (!hex.matches("^[a-f0-9]{64}$")) {
            throw new ContractViolationException("非法 sha256 摘要：" + hex);
        }
    }

    /** 计算字节内容的 SHA-256 哈希。 */
    public static ContentHash ofSha256(byte[] content) {
        Objects.requireNonNull(content, "content 不能为空");
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(content);
            return new ContentHash("sha256", HexFormat.of().formatHex(digest));
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 是 JDK 必备算法，不会发生；保留显式失败路径
            throw new IllegalStateException("JDK 缺少 SHA-256 实现", e);
        }
    }

    /** 计算文本内容（UTF-8）的 SHA-256 哈希。 */
    public static ContentHash ofSha256(String text) {
        return ofSha256(text.getBytes(StandardCharsets.UTF_8));
    }

    /** 从合同规范形式（sha256:...）解析。 */
    public static ContentHash parse(String canonical) {
        Objects.requireNonNull(canonical, "canonical 不能为空");
        if (!CANONICAL.matcher(canonical).matches()) {
            throw new ContractViolationException("非法内容哈希规范形式：" + canonical);
        }
        return new ContentHash("sha256", canonical.substring("sha256:".length()));
    }

    /** 序列化为合同规范形式，如 {@code sha256:ab12...}。 */
    public String canonical() {
        return algorithm + ":" + hex;
    }
}
