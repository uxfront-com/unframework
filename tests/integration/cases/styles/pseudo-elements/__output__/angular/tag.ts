import { Component, input } from "@angular/core";

@Component({
  selector: "uf-tag",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    <span
      class="tag"
      [class]="this.class()"
      [style]="this.style()"
      data-uf-ef5e671c=""
    >{{ name }}</span>
  `,
})
export default class Tag {
  readonly name = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
