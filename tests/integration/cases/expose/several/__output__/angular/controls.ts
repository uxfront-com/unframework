import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Counter from "./counter";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-controls",
  imports: [Counter, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <div
      class="controls"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <uf-counter #counter [start]="10" />
      <button type="button" (click)="onMore()">More</button>
      <button type="button" (click)="onReset()">Reset</button>
    </div>
  `,
})
export default class Controls {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  private readonly counter = viewChild<{ increment(): void; reset(): void }>("counter");
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");

  protected onMore() {
    this.counter()?.increment();
  }

  protected onReset() {
    this.counter()?.reset();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
