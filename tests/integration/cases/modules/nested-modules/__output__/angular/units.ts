// The module `format.ts` reads: each output tree holds a copy of it too (ADR-0070).
export const UNITS = { km: "kilometres", mi: "miles" } as const;

export type Unit = keyof typeof UNITS;
