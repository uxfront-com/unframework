import { NgTemplateOutlet } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  TemplateRef,
  contentChild,
  inject,
  input,
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

/** The scope attributes taken off each host, for the roots its component renders later. */
const scopes = new WeakMap<Element, string[]>();

/**
 * Gives a root node of its component the scope attributes the component's styled parents put on
 * its host (ADR-0063), and takes them off the host, which keeps only `display: contents`.
 */
@Directive({ selector: "[ufScope]" })
export class ScopeAttributes implements OnInit {
  readonly ufScope = input.required<HTMLElement>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    const host = this.ufScope();
    let names = scopes.get(host);
    if (!names) {
      names = host.getAttributeNames().filter((name) => name.startsWith("data-uf-"));
      for (const name of names) this.renderer.removeAttribute(host, name);
      scopes.set(host, names);
    }
    for (const name of names) this.renderer.setAttribute(this.element.nativeElement, name, "");
  }
}

@Component({
  selector: "uf-table",
  imports: [NgTemplateOutlet, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let people = this.people();
    <ol aria-label="People" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
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
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
