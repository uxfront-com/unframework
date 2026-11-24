import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Legend, { LegendCaption, LegendSwatch } from "./legend";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-chart",
  imports: [Legend, LegendSwatch, LegendCaption, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let series = this.series();
    <div
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <uf-legend [items]="series" [label]="'Series'">
        <ng-template ufLegendSwatch let-item="item">
          <b>{{ item.slice(0, 1) }}</b>
        </ng-template>
        <ng-template ufLegendCaption let-item="item">
          <i>{{ item }}</i>
        </ng-template>
      </uf-legend>
      <uf-legend [items]="series" [label]="'Captions'">
        <ng-template ufLegendCaption let-item="item">
          <span>{{ item.toUpperCase() }}</span>
        </ng-template>
      </uf-legend>
    </div>
  `,
})
export default class Chart {
  readonly series = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
