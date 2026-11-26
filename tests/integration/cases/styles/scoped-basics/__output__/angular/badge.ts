import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, ViewEncapsulation, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-badge",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let count = this.count();
    <span
      class="badge"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      data-uf-d9cef2e7=""
      [ufScope]="this.host"
      #ufElement
    >
      <span class="label" data-uf-d9cef2e7="">{{ label }}</span>
      <span class="count" data-uf-d9cef2e7="">{{ count }}</span>
    </span>
  `,
  styleUrl: "./Badge.uf.tsx.css",
  encapsulation: ViewEncapsulation.None,
})
export default class Badge {
  readonly label = input.required<string>();
  readonly count = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLSpanElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
