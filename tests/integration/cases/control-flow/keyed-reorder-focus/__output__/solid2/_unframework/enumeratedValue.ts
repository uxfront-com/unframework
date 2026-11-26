/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
export function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
}
