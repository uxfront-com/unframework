import { Component, input } from "@angular/core";

@Component({
  selector: "uf-notice",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    @let tone = this.tone();
    <p role="status" class="notice" [class]="tone">{{ text }}</p>
  `,
})
export default class Notice {
  readonly text = input.required<string>();
  readonly tone = input.required<"info" | "quiet">();
}
