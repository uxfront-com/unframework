import Field from "./field";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-form",
  imports: [Field],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <form aria-label="Sign up" [class]="this.class()" [style]="this.style()">
      <uf-field [label]="'Email'" />
      <uf-field [label]="'Name'" />
    </form>
  `,
})
export default class Form {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
