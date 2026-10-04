import { Component, input } from "@angular/core";

export interface CalloutProps {
  heading: string;
  body: string;
}

@Component({
  selector: "uf-callout",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let heading = this.heading();
    @let body = this.body();
    <aside
      class="callout"
      [attr.aria-label]="heading"
      style="--callout-accent: #1f4d7a; border-left: 4px solid var(--callout-accent); padding: 8px 12px; color: #1a1a1a"
    >
      <p style="margin: 0; font-weight: 700">{{ heading }}</p>
      <p style="margin: 4px 0 0">{{ body }}</p>
    </aside>
  `,
})
export default class Callout {
  readonly heading = input.required<string>();
  readonly body = input.required<string>();
}
