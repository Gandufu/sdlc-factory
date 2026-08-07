import { describe, expect, it } from "vitest";

import { sha256 } from "../src/hash.js";

describe("sha256", () => {
  it("hashes the exact bytes without text normalization", () => {
    expect(sha256(Buffer.from([0x61, 0x0d, 0x0a]))).toBe(
      "8e4621379786ef42a4fec155cd525c291dd7db3c1fde3478522f4f61c03fd1bd",
    );
  });
});
