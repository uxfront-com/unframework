/** Joins class names: strings as they are, and the names of an object's truthy entries. */
export function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") names.push(part);
    else if (Array.isArray(part)) {
      const joined = cx(...part);
      if (joined) names.push(joined);
    } else if (part && typeof part === "object") {
      for (const [name, on] of Object.entries(part)) if (on) names.push(name);
    }
  }
  return names.join(" ");
}
