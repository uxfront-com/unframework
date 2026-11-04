// A shared module that reads another one (ADR-0070).
import { UNITS } from "./units";
import type { Unit } from "./units";

export function formatDistance(value: number, unit: Unit): string {
  return `${value} ${UNITS[unit]}`;
}
