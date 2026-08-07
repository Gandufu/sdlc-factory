import type { ExecutionPlan } from "./execution-plan.js";

type BaselineFacts = { codeBaselines: string[]; testBaselines: string[] };
type Recommendation = { action: "CODE" | "TEST"; cuName: string; todo: string; command: string };

export function recommendNext(plan: ExecutionPlan, facts: BaselineFacts): Recommendation {
  for (const unit of plan.units) {
    if (!facts.codeBaselines.includes(unit.cuId)) {
      return {
        action: "CODE",
        cuName: unit.cuName,
        todo: `执行 /sdlc-code ${unit.cuName}`,
        command: `/sdlc-code ${unit.cuName}`,
      };
    }
    if (!facts.testBaselines.includes(unit.cuId)) {
      return {
        action: "TEST",
        cuName: unit.cuName,
        todo: `执行 /sdlc-test ${unit.cuName}`,
        command: `/sdlc-test ${unit.cuName}`,
      };
    }
  }
  throw new Error("All capability units have current code and test baselines");
}
