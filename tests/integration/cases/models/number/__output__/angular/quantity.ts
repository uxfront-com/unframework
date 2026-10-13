import { Component, type WritableSignal, input, signal } from "@angular/core";

/**
 * Vue's `vModelText` (ADR-0054): the text a field shows for its model's value. It keeps the
 * field's own text where that text already means the value (`12.5kg` for `12.5` with a number
 * cast), or where the person is editing a trimmed field whose trimmed text is the value.
 */
function modelText(
  field: HTMLInputElement | HTMLTextAreaElement,
  value: unknown,
  modifiers: { trim?: boolean; number?: boolean },
): string {
  const text = field.value;
  const current = modifiers.number && !/^0\d/.test(text) ? looseToNumber(text) : text;
  const next = value ?? "";
  if (current === next) return text;
  const editing = field.ownerDocument.activeElement === field && field.type !== "range";
  if (editing && modifiers.trim && text.trim() === next) return text;
  return String(next);
}

/** What a field's text writes to its model, as Vue's `vModelText` reads it (ADR-0054). */
function writeModelText<T>(
  model: WritableSignal<T>,
  field: HTMLInputElement | HTMLTextAreaElement,
  modifiers: { trim?: boolean; number?: boolean },
): void {
  const text = modifiers.trim ? field.value.trim() : field.value;
  model.set((modifiers.number ? looseToNumber(text) : text) as T);
}

/** Vue's `looseToNumber`: the text's leading number, or the text when it has none. */
function looseToNumber(text: string): string | number {
  const number = Number.parseFloat(text);
  return Number.isNaN(number) ? text : number;
}

@Component({
  selector: "uf-quantity",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let count = this.count();
    @let volume = this.volume();
    <section aria-label="Order" [class]="this.class()" [style]="this.style()">
      <input
        type="number"
        aria-label="Count"
        min="0"
        #countField
        [value]="modelText(countField, this.count(), { number: true })"
        (input)="writeModelText(this.count, countField, { number: true })"
      />
      <input
        type="range"
        aria-label="Volume"
        min="0"
        max="10"
        #volumeField
        [value]="modelText(volumeField, this.volume(), { number: true })"
        (input)="writeModelText(this.volume, volumeField, { number: true })"
      />
      <output>Next: {{ count + 1 }}, volume {{ volume + 1 }}</output>
      <button type="button" (click)="onTen()">Ten</button>
    </section>
  `,
})
export default class Quantity {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly count = signal(2);
  protected readonly volume = signal(5);
  protected readonly modelText = modelText;
  protected readonly writeModelText = writeModelText;

  protected onTen() {
    this.count.set(10);
  }
}
