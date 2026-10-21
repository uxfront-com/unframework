import Frame from "./frame";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-gallery",
  imports: [Frame],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <section [class]="this.class()" [style]="this.style()">
      <uf-frame>
        <p class="caption" data-uf-9dc516fd-s="">A quiet harbour</p>
      </uf-frame>
      <p class="caption">Outside the frame</p>
    </section>
  `,
})
export default class Gallery {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
