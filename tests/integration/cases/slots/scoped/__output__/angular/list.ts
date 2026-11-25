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

/** What a template of `List`'s `item` slot reads: the slot's props. */
export type ListItemContext = { item: string; index: number };

/** A template of `List`'s `item` slot, its `let-` variables typed (ADR-0056). */
@Directive({ selector: "ng-template[ufListItem]" })
export class ListItem {
  static ngTemplateContextGuard(
    _directive: ListItem,
    _context: unknown,
  ): _context is ListItemContext & { $implicit: ListItemContext } {
    return true;
  }
}

@Component({
  selector: "uf-list",
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
      @for (item of items; track item; let index = $index) {
        <li>
          @if (this.itemTemplate(); as template) {
            <ng-container
              [ngTemplateOutlet]="template"
              [ngTemplateOutletContext]="{ $implicit: { item: item, index: index }, item: item, index: index }"
            />
          }
        </li>
      }
    </ul>
    <ng-content select="[ufListItem]" />
  `,
})
export default class List {
  readonly items = input.required<string[]>();
  readonly label = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  protected readonly itemTemplate = contentChild(ListItem, { read: TemplateRef });
  readonly ufElement = viewChild<ElementRef<HTMLUListElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
