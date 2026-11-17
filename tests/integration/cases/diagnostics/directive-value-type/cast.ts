// A generic helper whose return type comes from what its result is given to, as an assignment
// would type it: the directive's type is that context (ADR-0109).
export function cast<T>(value: unknown): T {
  return value as T;
}
