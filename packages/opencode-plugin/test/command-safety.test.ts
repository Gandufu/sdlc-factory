import { describe, expect, it } from "vitest";

import { assertSafeCommandArguments, safeCommandArguments } from "../src/command-safety.js";

describe("受控命令参数安全", () => {
  it("拒绝新命令携带敏感参数", () => {
    expect(() => assertSafeCommandArguments(["--password", "secret"]))
      .toThrow("受控命令参数不能包含");
    expect(() => assertSafeCommandArguments(["https://example.test?a=1&token=secret"]))
      .toThrow("受控命令参数不能包含");
    expect(() => assertSafeCommandArguments(["Authorization: Bearer secret"]))
      .toThrow("受控命令参数不能包含");
  });

  it("对历史证据的敏感参数进行投影脱敏", () => {
    expect(safeCommandArguments(["verify", "--password", "secret", "--token=value"]))
      .toEqual(["verify", "--password", "[REDACTED]", "--token=[REDACTED]"]);
    expect(safeCommandArguments(["https://example.test?a=1&token=secret"])[0])
      .not.toContain("secret");
  });
});
