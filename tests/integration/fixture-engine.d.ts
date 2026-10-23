// The fixture engine's virtual modules (harness/fixture-engine.ts, ADR-0064), as a styled output
// imports them.
declare module "virtual:fixture-engine" {
  export function chip(tone?: "plain" | "accent"): string;
}

declare module "virtual:fixture-engine.css" {}
