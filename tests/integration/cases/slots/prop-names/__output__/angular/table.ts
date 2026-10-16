import { NgTemplateOutlet } from "@angular/common";
import { Component, Directive, TemplateRef, contentChild, input } from "@angular/core";

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
  imports: [NgTemplateOutlet],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let people = this.people();
    <ol aria-label="People" [class]="this.class()" [style]="this.style()">
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
  protected readonly rowTemplate = contentChild(TableRow, { read: TemplateRef });
}
