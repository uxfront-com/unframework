import { Component, input } from "@angular/core";

@Component({
  selector: "uf-status",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let busy = this.busy();
    @let text = this.text();
    @if (busy) {
      <span class="badge" role="status">Saving</span>
    } @else {
      <button type="button" class="badge">{{ text }}</button>
    }
  `,
})
export default class Status {
  readonly busy = input.required<boolean>();
  readonly text = input.required<string>();
}
