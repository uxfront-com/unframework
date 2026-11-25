import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, ViewEncapsulation, inject, input, viewChild } from "@angular/core";
import "virtual:styleframe.css";

@Component({
  selector: "uf-panel",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    <section
      class="panel"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      data-uf-b6be1fd3=""
      [ufScope]="this.host"
      #ufElement
    >
      <p class="body" data-uf-b6be1fd3="">{{ text }}</p>
    </section>
  `,
  styleUrl: "./Panel.uf.tsx.css",
  encapsulation: ViewEncapsulation.None,
})
export default class Panel {
  readonly text = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
