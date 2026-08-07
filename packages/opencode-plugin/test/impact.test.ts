import { describe, expect, it } from "vitest";

import { affectedCapabilityUnits } from "../src/impact.js";

const units = [
  { cuId: "cu-home", cuName: "首页", dependencies: [] },
  { cuId: "cu-device-client", cuName: "设备连接", dependencies: ["cu-home"] },
  { cuId: "cu-device-info", cuName: "设备信息", dependencies: ["cu-device-client"] },
];

describe("affectedCapabilityUnits", () => {
  it("marks the changed CU and all transitive downstream dependants", () => {
    expect(affectedCapabilityUnits(units, ["cu-home"])).toEqual([
      "cu-home",
      "cu-device-client",
      "cu-device-info",
    ]);
  });

  it("does not stale unrelated upstream CUs", () => {
    expect(affectedCapabilityUnits(units, ["cu-device-info"])).toEqual(["cu-device-info"]);
  });
});
