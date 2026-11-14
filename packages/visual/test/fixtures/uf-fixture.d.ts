// The type of `virtual:uf-fixture` (uf-fixture.ts), which a checker of the outputs reads, as
// Angular's ngtsc does.
declare module "virtual:uf-fixture" {
  export function greeting(tone?: "plain" | "warm"): string;
}
