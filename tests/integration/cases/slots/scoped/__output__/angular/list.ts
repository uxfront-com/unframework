import { NgTemplateOutlet } from "@angular/common";
import { Component, Directive, TemplateRef, contentChild, input } from "@angular/core";

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
  imports: [NgTemplateOutlet],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let items = this.items();
    @let label = this.label();
    <ul [attr.aria-label]="label" [class]="this.class()" [style]="this.style()">
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
  protected readonly itemTemplate = contentChild(ListItem, { read: TemplateRef });
}
