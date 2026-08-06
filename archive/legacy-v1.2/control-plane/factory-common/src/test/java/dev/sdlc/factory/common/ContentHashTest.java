package dev.sdlc.factory.common;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** ContentHash 合同格式与计算正确性测试。 */
class ContentHashTest {

    @Test
    void shouldComputeKnownSha256() {
        // "abc" 的 SHA-256 是 RFC 标准测试向量
        ContentHash hash = ContentHash.ofSha256("abc");
        assertEquals("sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
                hash.canonical());
    }

    @Test
    void shouldParseCanonicalForm() {
        String canonical = "sha256:" + "a".repeat(64);
        ContentHash hash = ContentHash.parse(canonical);
        assertEquals("a".repeat(64), hash.hex());
        assertEquals(canonical, hash.canonical());
    }

    @Test
    void shouldRejectInvalidCanonicalForm() {
        assertThrows(ContractViolationException.class, () -> ContentHash.parse("md5:abc"));
        assertThrows(ContractViolationException.class, () -> ContentHash.parse("sha256:ZZ"));
    }
}
