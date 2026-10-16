import Panel from "./panel";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-greeting",
  imports: [Panel],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    <uf-panel [title]="'Welcome'" [class]="this.class()" [style]="this.style()">
      <p>Hello, <strong>{{ name }}</strong>!</p>
      <p>Your children render in the panel.</p>
    </uf-panel>
  `,
})
export default class Greeting {
  readonly name = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
