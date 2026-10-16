import Field from "./field";
import { Component, input, signal } from "@angular/core";

@Component({
  selector: "uf-form",
  imports: [Field],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let city = this.city();
    @let cleared = this.cleared();
    <section aria-label="Address" [class]="this.class()" [style]="this.style()">
      <uf-field [label]="'Street'" (clear)="clear($event)" />
      <uf-field [label]="city" [tone]="'warn'" (clear)="onClear($event)" />
      <output>Cleared: {{ cleared }}</output>
    </section>
  `,
})
export default class Form {
  readonly city = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly cleared = signal("nothing");

  protected clear(label: string) {
    this.cleared.set(label);
  }

  protected onClear(label: string) {
    this.clear(label.toUpperCase());
  }
}
