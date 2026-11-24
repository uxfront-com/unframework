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
  signal,
  viewChild,
} from "@angular/core";

/** A template of `Rows`'s `row` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufRowsRow]" })
export class RowsRow {
  static ngTemplateContextGuard(
    _directive: RowsRow,
    _context: unknown,
  ): _context is Record<never, never> {
    return true;
  }
}

@Component({
  selector: "uf-rows",
  imports: [NgTemplateOutlet, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let items = this.items();
    <div
      class="rows"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <ul>
        @for (item of items; track item) {
          <li>
            @if (this.rowTemplate(); as template) {
              <ng-container [ngTemplateOutlet]="template" />
            }
          </li>
        }
      </ul>
      <button type="button" (click)="onAddRow()">Add row</button>
      <button type="button" (click)="onRemoveRow()">Remove row</button>
    </div>
    <ng-content select="[ufRowsRow]" />
  `,
})
export default class Rows {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  protected readonly rowTemplate = contentChild(RowsRow, { read: TemplateRef });
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly items = signal([1, 2]);

  protected onAddRow() {
    this.items.set([...this.items(), this.items().length + 1]);
  }

  protected onRemoveRow() {
    this.items.set(this.items().slice(0, -1));
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
