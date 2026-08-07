export class ExecutionPlanError extends Error {}

export type CapabilityUnit = {
  cuId: string;
  cuName: string;
  dependencies: string[];
};

export type ExecutionPlan = {
  planVersion: number;
  designHash: string;
  units: CapabilityUnit[];
};

export function validateExecutionPlan(plan: ExecutionPlan): void {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const unit of plan.units) {
    if (!unit.cuId || !unit.cuName.trim() || ids.has(unit.cuId) || names.has(unit.cuName)) {
      throw new ExecutionPlanError(`Duplicate or empty CU identity: ${unit.cuName}`);
    }
    ids.add(unit.cuId);
    names.add(unit.cuName);
  }
  for (const unit of plan.units) {
    if (unit.dependencies.some((dependency) => !ids.has(dependency) || dependency === unit.cuId)) {
      throw new ExecutionPlanError(`Invalid dependency for CU: ${unit.cuName}`);
    }
  }
}
