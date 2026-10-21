import Heading from "./heading";
import Status from "./status";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-panel",
  imports: [Heading, Status],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <section class="panel" [class]="this.class()" [style]="this.style()" data-uf-34db6205="">
      <uf-heading [big]="true" [text]="'Release'" data-uf-34db6205="" />
      <uf-heading [big]="false" [text]="'Notes'" data-uf-34db6205="" />
      <uf-status [busy]="false" [text]="'Save'" data-uf-34db6205="" />
      <uf-status [busy]="true" [text]="'Save'" data-uf-34db6205="" />
    </section>
  `,
})
export default class Panel {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
