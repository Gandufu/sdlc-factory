import { describe, expect, it } from "vitest";

import { ExecutionPlanError, validateExecutionPlan } from "../src/execution-plan.js";
import { recommendNext } from "../src/recommendation.js";

const plan = {
  planVersion: 1,
  designHash: "a".repeat(64),
  units: [
    { cuId: "cu-home", cuName: "首页", dependencies: [] },
    { cuId: "cu-device", cuName: "设备信息", dependencies: ["cu-home"] },
  ],
};

describe("validateExecutionPlan", () => {
  it("rejects duplicate user-facing CU names", () => {
    expect(() => validateExecutionPlan({
      ...plan,
      units: [...plan.units, { cuId: "cu-other", cuName: "首页", dependencies: [] }],
    })).toThrow(ExecutionPlanError);
  });
});

describe("recommendNext", () => {
  it("recommends one complete coding command for the first CU without a code baseline", () => {
    expect(recommendNext(plan, { codeBaselines: [], testBaselines: [] })).toEqual({
      action: "CODE",
      cuName: "首页",
      todo: "执行 /sdlc-code 首页",
      command: "/sdlc-code 首页",
    });
  });

  it("recommends testing before moving to the next CU", () => {
    expect(recommendNext(plan, { codeBaselines: ["cu-home"], testBaselines: [] })).toEqual({
      action: "TEST",
      cuName: "首页",
      todo: "执行 /sdlc-test 首页",
      command: "/sdlc-test 首页",
    });
  });
});
