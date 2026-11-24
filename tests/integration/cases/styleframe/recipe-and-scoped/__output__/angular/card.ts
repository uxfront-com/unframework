import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, ViewEncapsulation, inject, input, viewChild } from "@angular/core";
import { button } from "virtual:styleframe";
import "virtual:styleframe.css";

@Component({
  selector: "uf-card",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    <article
      class="card"
      [class]="[button({ size: 'lg', tone: 'primary' }), this.class()].join(' ')"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      data-uf-9cfb6163=""
      [ufScope]="this.host"
      #ufElement
    >
      <h2 class="title" data-uf-9cfb6163="">{{ title }}</h2>
    </article>
  `,
  styleUrl: "./Card.uf.tsx.css",
  encapsulation: ViewEncapsulation.None,
})
export default class Card {
  readonly title = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly button = button;
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
