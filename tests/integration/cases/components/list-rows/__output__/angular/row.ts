import { Component, input } from "@angular/core";

@Component({
  selector: "uf-row",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let done = this.done();
    <div role="listitem" class="row" [class]="{ done }">{{ name }}{{ done ? " (done)" : "" }}</div>
  `,
})
export default class Row {
  readonly name = input.required<string>();
  readonly done = input.required<boolean>();
}
