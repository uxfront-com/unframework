import Hint from "./hint";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-banner",
  imports: [Hint],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let tip = this.tip();
    <div class="banner" [class]="this.class()" [style]="this.style()" data-uf-e25060c2="">
      <uf-hint [text]="tip" data-uf-e25060c2="" />
    </div>
  `,
})
export default class Banner {
  readonly tip = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
