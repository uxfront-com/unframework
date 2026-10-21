import { Component, input } from "@angular/core";

@Component({
  selector: "uf-chip",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let variant = this.variant();
    @let pressed = this.pressed();
    <button
      type="button"
      class="chip"
      [attr.data-variant]="variant"
      [attr.data-state]="pressed ? 'on' : 'off'"
      [attr.aria-pressed]="pressed ? 'true' : 'false'"
      [class]="this.class()"
      [style]="this.style()"
      data-uf-69db3802=""
    >{{ label }}</button>
  `,
})
export default class Chip {
  readonly label = input.required<string>();
  readonly variant = input<"neutral" | "danger", "neutral" | "danger" | undefined>("neutral", {
    transform: (value) => (value === undefined ? "neutral" : value),
  });
  readonly pressed = input<boolean, boolean | undefined>(false, {
    transform: (value) => (value === undefined ? false : value),
  });
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
