package dev.sdlc.factory.common;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** StableId 前缀与格式校验测试。 */
class StableIdTest {

    @Test
    void shouldAcceptContractPatterns() {
        assertEquals("RUN-01J9", StableId.run("RUN-01J9").value());
        assertEquals("PRJ-SAT-01", StableId.project("PRJ-SAT-01").value());
        assertEquals("GCM-1", StableId.gateCommand("GCM-1").value());
    }

    @Test
    void shouldRejectWrongPrefixOrLowercase() {
        assertThrows(ContractViolationException.class, () -> StableId.run("PRJ-001"));
        assertThrows(ContractViolationException.class, () -> StableId.run("RUN-lower"));
        assertThrows(ContractViolationException.class, () -> StableId.run("RUN-"));
    }
}
