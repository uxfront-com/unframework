import { Component, input } from "@angular/core";

@Component({
  selector: "uf-badge",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let tone = this.tone();
    <span class="badge" [class]="tone">{{ tone }}</span>
  `,
})
export class Badge {
  readonly tone = input.required<"info" | "warning">();
}
