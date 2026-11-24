import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Rows, { RowsRow } from "./rows";
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

/** A template of `Wrapper`'s `row` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufWrapperRow]" })
export class WrapperRow {
  static ngTemplateContextGuard(
    _directive: WrapperRow,
    _context: unknown,
  ): _context is Record<never, never> {
    return true;
  }
}

@Component({
  selector: "uf-wrapper",
  imports: [Rows, RowsRow, NgTemplateOutlet, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <section
      class="wrapper"
      aria-label="Rows"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <uf-rows>
        @if (this.rowTemplate(); as template) {
          <ng-template ufRowsRow>
            <ng-container [ngTemplateOutlet]="template" />
          </ng-template>
        }
      </uf-rows>
    </section>
    <ng-content select="[ufWrapperRow]" />
  `,
})
export default class Wrapper {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  protected readonly rowTemplate = contentChild(WrapperRow, { read: TemplateRef });
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
