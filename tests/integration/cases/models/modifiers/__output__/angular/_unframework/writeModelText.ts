import { looseToNumber } from "./looseToNumber";
import type { WritableSignal } from "@angular/core";

/** What a field's text writes to its model, as Vue's `vModelText` reads it (ADR-0054). */
export function writeModelText<T>(
  model: WritableSignal<T>,
  field: HTMLInputElement | HTMLTextAreaElement,
  modifiers: { trim?: boolean; number?: boolean },
): void {
  const text = modifiers.trim ? field.value.trim() : field.value;
  model.set((modifiers.number ? looseToNumber(text) : text) as T);
}
