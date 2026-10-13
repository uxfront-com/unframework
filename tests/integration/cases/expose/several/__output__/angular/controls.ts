import Counter from "./counter";
import { Component, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-controls",
  imports: [Counter],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <div class="controls" [class]="this.class()" [style]="this.style()">
      <uf-counter #counter [start]="10" />
      <button type="button" (click)="onMore()">More</button>
      <button type="button" (click)="onReset()">Reset</button>
    </div>
  `,
})
export default class Controls {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  private readonly counter = viewChild<{ increment(): void; reset(): void }>("counter");

  protected onMore() {
    this.counter()?.increment();
  }

  protected onReset() {
    this.counter()?.reset();
  }
}
