import { Component, input, output } from "@angular/core";

export interface FieldProps {
  label: string;
  tone?: "info" | "warn";
}

@Component({
  selector: "uf-field",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let tone = this.tone();
    <div class="field" [class]="[tone, this.class()].join(' ')" [style]="this.style()">
      <span>{{ label }}</span>
      <button type="button" (click)="clear.emit(label)">Clear {{ label }}</button>
    </div>
  `,
})
export default class Field {
  readonly label = input.required<string>();
  readonly tone = input<"info" | "warn", "info" | "warn" | undefined>("info", {
    transform: (value) => (value === undefined ? "info" : value),
  });
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly clear = output<string>();
}
