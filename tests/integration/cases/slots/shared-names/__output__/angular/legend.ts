import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { NgTemplateOutlet } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  TemplateRef,
  contentChild,
  inject,
  input,
  viewChild,
} from "@angular/core";

/** What a template of `Legend`'s `swatch` slot reads: the slot's props. */
export type LegendSwatchContext = { item: string };

/** A template of `Legend`'s `swatch` slot, its `let-` variables typed (ADR-0056). */
@Directive({ selector: "ng-template[ufLegendSwatch]" })
export class LegendSwatch {
  static ngTemplateContextGuard(
    _directive: LegendSwatch,
    _context: unknown,
  ): _context is LegendSwatchContext & { $implicit: LegendSwatchContext } {
    return true;
  }
}

/** What a template of `Legend`'s `caption` slot reads: the slot's props. */
export type LegendCaptionContext = { item: string };

/** A template of `Legend`'s `caption` slot, its `let-` variables typed (ADR-0056). */
@Directive({ selector: "ng-template[ufLegendCaption]" })
export class LegendCaption {
  static ngTemplateContextGuard(
    _directive: LegendCaption,
    _context: unknown,
  ): _context is LegendCaptionContext & { $implicit: LegendCaptionContext } {
    return true;
  }
}

@Component({
  selector: "uf-legend",
  imports: [NgTemplateOutlet, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let items = this.items();
    @let label = this.label();
    <ul
      [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : label"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      @for (item of items; track item) {
        <li>
          <span>@if (this.swatchTemplate(); as template) {<ng-container
            [ngTemplateOutlet]="template"
            [ngTemplateOutletContext]="{ $implicit: { item: item }, item: item }"
          />}</span>&ngsp;<span>@if (this.captionTemplate(); as template) {<ng-container
            [ngTemplateOutlet]="template"
            [ngTemplateOutletContext]="{ $implicit: { item: item }, item: item }"
          />}</span>
        </li>
      }
    </ul>
    <ng-content select="[ufLegendSwatch]" />
    <ng-content select="[ufLegendCaption]" />
  `,
})
export default class Legend {
  readonly items = input.required<string[]>();
  readonly label = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  protected readonly swatchTemplate = contentChild(LegendSwatch, { read: TemplateRef });
  protected readonly captionTemplate = contentChild(LegendCaption, { read: TemplateRef });
  readonly ufElement = viewChild<ElementRef<HTMLUListElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
