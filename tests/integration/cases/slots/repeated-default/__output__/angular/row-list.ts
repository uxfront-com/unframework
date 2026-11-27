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

/** A template of `RowList`'s `default` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufRowListDefault]" })
export class RowListDefault {
  static ngTemplateContextGuard(
    _directive: RowListDefault,
    _context: unknown,
  ): _context is Record<never, never> {
    return true;
  }
}

@Component({
  selector: "uf-row-list",
  imports: [NgTemplateOutlet, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let items = this.items();
    <ul
      class="row-list"
      [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : label"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      @for (item of items; track item) {
        <li>{{ item }}&ngsp;@if (this.defaultTemplate(); as template) {<ng-container
          [ngTemplateOutlet]="template"
        />}</li>
      }
    </ul>
    <ng-content select="[ufRowListDefault]" />
  `,
})
export default class RowList {
  readonly label = input.required<string>();
  readonly items = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  private readonly defaultTemplate = contentChild(RowListDefault, { read: TemplateRef });
  readonly ufElement = viewChild<ElementRef<HTMLUListElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
