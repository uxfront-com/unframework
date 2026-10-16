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
  selector: "uf-profile",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let city = this.city();
    @let weight = this.weight();
    <form aria-label="Profile" [class]="this.class()" [style]="this.style()">
      <label>Name <input
        #nameField
        [value]="modelText(nameField, this.name(), { trim: true })"
        (input)="writeModelText(this.name, nameField, { trim: true })"
        (change)="nameField.value = nameField.value.trim()"
      /></label>
      <label>City <input
        #cityField
        [value]="this.city()"
        (change)="this.city.set(cityField.value)"
      /></label>
      <label>Weight <input
        #weightField
        [value]="modelText(weightField, this.weight(), { number: true })"
        (input)="writeModelText(this.weight, weightField, { number: true })"
      /></label>
      <output>[{{ name }}] from {{ city }}, {{ weight + 1 }}</output>
    </form>
  `,
})
export default class Profile {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly name = signal("");
  protected readonly city = signal("Lisbon");
  protected readonly weight = signal(0);
  protected readonly modelText = modelText;
  protected readonly writeModelText = writeModelText;
}
