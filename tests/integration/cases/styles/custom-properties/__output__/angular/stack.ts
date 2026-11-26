import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, ViewEncapsulation, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-stack",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let gap = this.gap();
    @let accent = this.accent();
    <ul
      class="stack"
      [style]="{ '--gap': gap, '--accent': accent, ...this.style() }"
      [class]="this.class()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      data-uf-e3a22111=""
      [ufScope]="this.host"
      #ufElement
    >
      <li class="item" data-uf-e3a22111="">One</li>
      <li class="item" data-uf-e3a22111="">Two</li>
      <li class="item" data-uf-e3a22111="">Three</li>
    </ul>
  `,
  styleUrl: "./Stack.uf.tsx.css",
  encapsulation: ViewEncapsulation.None,
})
export default class Stack {
  readonly gap = input.required<string>();
  readonly accent = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLUListElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
