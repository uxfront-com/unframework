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

/** What a template of `EachSlot`'s `row` slot reads: the slot's props. */
export type EachSlotRowContext = { item: string };

/** A template of `EachSlot`'s `row` slot, its `let-` variables typed (ADR-0056). */
@Directive({ selector: "ng-template[ufEachSlotRow]" })
export class EachSlotRow {
  static ngTemplateContextGuard(
    _directive: EachSlotRow,
    _context: unknown,
  ): _context is EachSlotRowContext & { $implicit: EachSlotRowContext } {
    return true;
  }
}

@Component({
  selector: "uf-each-slot",
  imports: [NgTemplateOutlet, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let items = this.items();
    <span
      class="each-slot"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      @for (item of items; track item) {
        <span class="each-row">
          @if (this.rowTemplate(); as template) {
            <ng-container
              [ngTemplateOutlet]="template"
              [ngTemplateOutletContext]="{ $implicit: { item: item }, item: item }"
            />
          }
        </span>
      }
    </span>
    <ng-content select="[ufEachSlotRow]" />
  `,
})
export default class EachSlot {
  readonly items = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  protected readonly rowTemplate = contentChild(EachSlotRow, { read: TemplateRef });
  readonly ufElement = viewChild<ElementRef<HTMLSpanElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
