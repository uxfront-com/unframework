import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export interface ExcerptProps {
  title: string;
  text: string;
  fill: string;
  stroke: string;
}

@Component({
  selector: "uf-excerpt",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let text = this.text();
    @let fill = this.fill();
    @let stroke = this.stroke();
    <article
      class="excerpt"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <h2
        style="-webkit-text-stroke-width: 1px; color: rgb(0, 0, 0)"
        [style.-webkit-text-fill-color]="fill"
        [style.-webkit-text-stroke-color]="stroke"
      >{{ title }}</h2>
      <p
        style="display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; width: 240px"
      >{{ text }}</p>
    </article>
  `,
})
export default class Excerpt {
  readonly title = input.required<string>();
  readonly text = input.required<string>();
  readonly fill = input.required<string>();
  readonly stroke = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
