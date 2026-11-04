// Pure helpers shared by components (ADR-0070): each output imports them from its copy of this
// module, and calls them in its template, its derived values and its listeners alike.
export function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

export function pluralise(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
