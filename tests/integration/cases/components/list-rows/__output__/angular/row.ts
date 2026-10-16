import { Component, input } from "@angular/core";

@Component({
  selector: "uf-row",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let done = this.done();
    <div
      role="listitem"
      class="row"
      [class]="[done ? 'done' : null, this.class()].join(' ')"
      [style]="this.style()"
    >{{ name }}{{ done ? " (done)" : "" }}</div>
  `,
})
export default class Row {
  readonly name = input.required<string>();
  readonly done = input.required<boolean>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
