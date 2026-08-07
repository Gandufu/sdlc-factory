import type { CapabilityUnit } from "./execution-plan.js";

export function affectedCapabilityUnits(units: CapabilityUnit[], changedCuIds: string[]): string[] {
  const affected = new Set(changedCuIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const unit of units) {
      if (!affected.has(unit.cuId) && unit.dependencies.some((dependency) => affected.has(dependency))) {
        affected.add(unit.cuId);
        changed = true;
      }
    }
  }
  return units.filter((unit) => affected.has(unit.cuId)).map((unit) => unit.cuId);
}
