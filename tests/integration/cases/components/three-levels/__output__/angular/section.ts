import Heading from "./heading";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-section",
  imports: [Heading],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let body = this.body();
    <section class="section" [class]="this.class()" [style]="this.style()">
      <uf-heading [text]="title" />
      <p>{{ body }}</p>
    </section>
  `,
})
export default class Section {
  readonly title = input.required<string>();
  readonly body = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
