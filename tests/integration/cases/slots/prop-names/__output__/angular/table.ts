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

export interface Person {
  id: string;
  name: string;
}

/** What a template of `Table`'s `row` slot reads: the slot's props. */
export type TableRowContext = { name: string; "data-id": string; index: number } & {
  dataId: string;
};

/** A template of `Table`'s `row` slot, its `let-` variables typed (ADR-0056). */
@Directive({ selector: "ng-template[ufTableRow]" })
export class TableRow {
  static ngTemplateContextGuard(
    _directive: TableRow,
    _context: unknown,
  ): _context is TableRowContext & { $implicit: TableRowContext } {
    return true;
  }
}

@Component({
  selector: "uf-table",
  imports: [NgTemplateOutlet, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let people = this.people();
    <ol
      aria-label="People"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      @for (person of people; track person.id; let index = $index) {
        <li>
          @if (this.rowTemplate(); as template) {
            <ng-container
              [ngTemplateOutlet]="template"
              [ngTemplateOutletContext]="{ $implicit: { name: person.name, 'data-id': person.id, index: index }, name: person.name, dataId: person.id, index: index }"
            />
          }
        </li>
      }
    </ol>
    <ng-content select="[ufTableRow]" />
  `,
})
export default class Table {
  readonly people = input.required<Person[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  protected readonly rowTemplate = contentChild(TableRow, { read: TemplateRef });
  readonly ufElement = viewChild<ElementRef<HTMLOListElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
